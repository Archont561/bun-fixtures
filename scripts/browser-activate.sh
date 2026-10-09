# pixi activation for the `browser` environment (see [feature.browser.activation]).
# Browser tests run headless only; the fixtures launch Chromium through
# Playwright, which spawns the browser as a child of the test process.
#
# Playwright's browser binaries live outside the conda prefix, so put this
# environment's lib/ first on the loader path; system defaults stay reachable.
export LD_LIBRARY_PATH="$CONDA_PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
