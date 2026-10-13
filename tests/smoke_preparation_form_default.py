"""Preparation fields retain defaults and support Enter-to-apply navigation."""
import smoke_app
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    smoke_app.extract_supa_config = lambda: ('', '')
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(url.rsplit("/", 1)[0] + "/") else route.abort())
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function("typeof presenterPreparationDisplayTextForService === 'function' && typeof renderPresenterServiceInputRail === 'function' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate("""async () => {
                  const check = (ok, message) => { if (!ok) throw new Error(message); };
                  const service = { id: '__prep_values_default__', type_id: 'sunday-main', date: '2026-09-20', title: '주일예배 [3부]' };
                  const previous = { services: state.services, items: state.serviceItems, drafts: state.presenterPreparationDrafts, dirty: state.dirty.service, apply: applyPresenterPreparationInput };
                  const fields = html => { const host = document.createElement('div'); host.innerHTML = html; return [...host.querySelectorAll('[data-presenter-preparation-field]')]; };
                  try {
                    state.services = [service, ...previous.services]; state.presenterPreparationDrafts = {};
                    const inputs = fields(renderPresenterServiceInputRail(service));
                    check(inputs.length > 0 && inputs.some((input) => input.value), 'template defaults must be shown in value fields');
                    check(inputs.every((input) => input.dataset.presenterPreparationFieldLabel), 'each field needs a fixed label');
                    check(inputs.some((input) => input.dataset.presenterPreparationFieldLabel === '찬양 1'), 'numbered praise label needs readable spacing');
                    check(inputs.some((input) => input.dataset.presenterPreparationFieldLabel === '인용 구절'), 'citation label needs readable spacing');
                    const host = document.createElement('div'); host.innerHTML = renderPresenterServiceInputRail(service);
                    check(!host.querySelector('[data-presenter-preparation-form]'), 'no form button');
                    state.presenterPreparationDrafts[service.id] = '찬양1: 주 은혜임을';
                    check(fields(renderPresenterServiceInputRail(service))[0].value === '주 은혜임을', 'typed value is retained');
                    delete state.presenterPreparationDrafts[service.id];
                    check(fields(renderPresenterServiceInputRail(service)).some((input) => input.value), 'cleared draft restores template defaults');

                    state.module='presenter';document.body.dataset.module='presenter';
                    setRightSidebarContent(renderPresenterServiceInputRail(service));
                    const interaction = refs.rightSidebar;
                    const enterFields = [...interaction.querySelectorAll('[data-presenter-preparation-field]')];
                    let enterCall = null;
                    applyPresenterPreparationInput = async (...args) => { enterCall = args; focusPresenterPreparationTarget(args[0], args[1].focusTarget); };
                    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    enterFields[0].focus();
                    check(document.activeElement === enterFields[0], 'first field focused');
                    enterFields[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                    check(enterCall && enterCall[1].focusTarget.label === enterFields[1].dataset.presenterPreparationFieldLabel, 'Enter applies then targets the next field');
                    await settle();
                    check(document.activeElement === enterFields[1], 'Enter focuses next right-rail field');
                    const last = enterFields.at(-1);last.focus();
                    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                    await settle();
                    check(enterCall[1].focusTarget.apply, 'last field targets apply');
                    check(document.activeElement === interaction.querySelector('[data-presenter-preparation-apply]'), 'last Enter focuses apply button');
                    setRightSidebarContent('');
                    return 'ok';
                  } finally { state.services = previous.services; state.serviceItems = previous.items; state.presenterPreparationDrafts = previous.drafts; state.dirty.service = previous.dirty; applyPresenterPreparationInput = previous.apply; }
                }""")
                assert result == "ok", result
                print("PASS", engine, "right-rail defaults, draft retention, next-field and apply-button focus", flush=True)
                browser.close()

    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
