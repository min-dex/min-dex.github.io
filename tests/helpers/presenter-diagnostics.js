// Test-only aggregation; validate each slide through the production validator.
globalThis.presenterSlidesModelIssues = function (slides = []) {
  return (Array.isArray(slides) ? slides : []).flatMap((slide, index) =>
    presenterSlideModelIssues(slide).map((issue) => ({
      index,
      id: slide?.id || "",
      title: slide?.title || "",
      issue,
    })));
};
