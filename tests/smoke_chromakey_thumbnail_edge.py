"""Detect chromakey bleed at the lower edge of actual slide thumbnails."""
from io import BytesIO

from PIL import Image

from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def is_chromakey_green(pixel):
    red, green, blue = pixel
    return green > red + 80 and green > blue + 80 and green > 180


def lower_edge_green_pixels(image):
    # Ignore the rounded corners; inspect the exact rows where the caption bar
    # reaches the frame edge. A green pixel here is a compositor seam, not slide
    # content.
    x_start = max(6, round(image.width * 0.08))
    x_end = min(image.width - 6, round(image.width * 0.92))
    y_start = max(0, image.height - max(4, round(image.height * 0.035)))
    return [
        (x, y, image.getpixel((x, y)))
        for y in range(y_start, image.height)
        for x in range(x_start, x_end)
        if is_chromakey_green(image.getpixel((x, y)))
    ]


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine, dpr in [(engine, dpr) for engine in ["chromium", "webkit"] for dpr in [1, 1.25, 2]]:
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page(viewport={"width": 1100, "height": 700}, device_scale_factor=dpr)
                page.route("**/*supabase*/**", lambda route: route.abort())
                page.goto(url + "?output=presenter", wait_until="domcontentloaded")
                page.wait_for_function("typeof presenterSlideRenderClass === 'function' && typeof applyPresenterPreviewScales === 'function'")
                page.evaluate(
                    """() => {
                      state.services = [{
                        id: "thumbnail-edge-fixture",
                        type_id: "sunday-main",
                        title: "thumbnail edge fixture",
                      }];
                      const host = document.createElement("div");
                      host.id = "thumbnail-edge-fixture";
                      host.className = "svc-slide-thumb-frame svc-slide-thumb-frame--lyrics";
                      host.style.cssText = "position:fixed;left:10.25px;top:10.5px;width:405px;z-index:99999";
                      host.innerHTML = renderPresenterSlideMiniPreview({
                          type: "lyrics",
                          elementType: "praise",
                          layout: "lower_bar_text",
                          text: "예수의 길",
                          title: "예수의 길",
                        }, "thumbnail-edge-fixture");
                      document.body.append(host);
                      applyPresenterPreviewScales(document);
                    }"""
                )
                backing = page.evaluate(
                    """() => {
                      const output = document.querySelector("#thumbnail-edge-fixture .svc-slide-mini-output");
                      const canvas = output?.querySelector(".svc-slide-mini-canvas");
                      return {
                        outputClass: output?.className || "",
                        canvasClass: canvas?.className || "",
                        outputBackground: getComputedStyle(output).backgroundImage,
                        canvasBackground: getComputedStyle(canvas).backgroundImage,
                      };
                    }"""
                )
                assert (
                    "lower-bar-underlay" not in backing["outputClass"]
                    and "lower-bar-underlay" not in backing["canvasClass"]
                    and backing["outputBackground"] == "none"
                    and "gradient" in backing["canvasBackground"]
                ), backing
                for width in [220, 254.5, 296, 360, 404.5, 405, 405.5, 406.25]:
                    page.evaluate(
                        """width => {
                          const host = document.getElementById("thumbnail-edge-fixture");
                          host.style.width = width + "px";
                          applyPresenterPreviewScales(document);
                        }""",
                        width,
                    )
                    image = Image.open(
                        BytesIO(page.locator("#thumbnail-edge-fixture").screenshot())
                    ).convert("RGB")
                    green_pixels = lower_edge_green_pixels(image)
                    assert not green_pixels, (engine, dpr, width, image.size, green_pixels[:8])
                    geometry = page.evaluate(
                        """() => {
                          const frame = document.getElementById("thumbnail-edge-fixture").getBoundingClientRect();
                          const canvas = document.querySelector("#thumbnail-edge-fixture .svc-slide-mini-canvas").getBoundingClientRect();
                          return { frame: { width: frame.width, height: frame.height }, canvas: { width: canvas.width, height: canvas.height } };
                        }"""
                    )
                    assert geometry["canvas"]["width"] >= geometry["frame"]["width"], (engine, dpr, width, geometry)
                    assert geometry["canvas"]["height"] >= geometry["frame"]["height"], (engine, dpr, width, geometry)
                    assert geometry["canvas"]["width"] - geometry["frame"]["width"] <= 2, (engine, dpr, width, geometry)
                    assert geometry["canvas"]["height"] - geometry["frame"]["height"] <= 2, (engine, dpr, width, geometry)
                print("PASS thumbnail lower edge", engine, "DPR", dpr, flush=True)
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
