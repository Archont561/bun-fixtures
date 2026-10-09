#!/bin/sh
# Starts the X server of the pixi `browser` environment, for headed browsers.
#
#   pixi run -e browser xvfb &                  # display :99, 1280x720x24
#   DISPLAY=:99 pixi run -e browser bun test    # then run headed tests
#
# Arguments replace the defaults and go to Xvfb unchanged. `-displayfd 1` asks
# for an unused display, which Xvfb prints on stdout once it accepts clients;
# packages/browser/tests/headed-chromium.test.ts uses it.
#
# Xvfb does not start from a restored bundle until the repairs in
# browser-activate.sh are applied, and sourcing that file applies them. This
# script execs Xvfb, so backgrounding it leaves the X server itself running.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
CONDA_PREFIX="$root/.pixi/envs/browser"
export CONDA_PREFIX

if [ ! -x "$CONDA_PREFIX/bin/Xvfb" ]; then
  echo "xvfb.sh: no Xvfb at $CONDA_PREFIX/bin/Xvfb; run 'pixi install -e browser' (or scripts/restore.sh) first" >&2
  exit 1
fi

. "$root/scripts/browser-activate.sh"
PATH="$CONDA_PREFIX/bin:$PATH"
export PATH

if [ "$#" -eq 0 ]; then
  set -- :99 -screen 0 1280x720x24 -nolisten tcp
fi
exec "$CONDA_PREFIX/bin/Xvfb" "$@"
