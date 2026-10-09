# pixi activation for the `browser` environment (see [feature.browser.activation]).
# scripts/xvfb.sh sources this file too, so the X server runs in the same
# environment as the browsers.
#
# Playwright's browser binaries live outside the conda prefix, so put this
# environment's lib/ first on the loader path; system defaults stay reachable.
export LD_LIBRARY_PATH="$CONDA_PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# Repairs for a restored bundle (scripts/restore.sh). Neither changes a normal
# install. Each step is idempotent and non-fatal: an activation script must
# never break `pixi run`. Verified on the restored bundle: Xvfb fails with
# "Failed to compile keymap" when either repair is missing, and starts with both.
#
# 1. Keymap data. xkeyboard-config installs its data to share/xkeyboard-config-2
#    and expects share/X11/xkb to link there. In the restored bundle that link
#    is displaced by xorg-xvfb-server's share/X11/xkb/compiled/ directory, so
#    the keymap rules are missing. Link each data directory back into place.
if [ -d "$CONDA_PREFIX/share/xkeyboard-config-2" ]; then
  mkdir -p "$CONDA_PREFIX/share/X11/xkb" 2>/dev/null || true
  for _btu_dir in "$CONDA_PREFIX"/share/xkeyboard-config-2/*; do
    [ -d "$_btu_dir" ] || continue
    _btu_name=${_btu_dir##*/}
    _btu_link="$CONDA_PREFIX/share/X11/xkb/$_btu_name"
    if [ ! -e "$_btu_link" ] && [ ! -L "$_btu_link" ]; then
      ln -s "../../xkeyboard-config-2/$_btu_name" "$_btu_link" 2>/dev/null || true
    fi
  done
fi

# 2. Staging prefix. The binaries keep the path they were built under,
#    .pixi/.restore-work/stage-<env>/<env>, and restore does not rewrite it inside
#    them. Xvfb runs its keymap compiler from that path, so the path must resolve
#    to this environment. It is read from Xvfb rather than assumed.
_btu_xvfb="$CONDA_PREFIX/bin/Xvfb"
if [ -x "$_btu_xvfb" ]; then
  _btu_stage=$(tr -c '[:print:]' '\n' < "$_btu_xvfb" 2>/dev/null |
    grep -o -m 1 '/[^ ]*\.restore-work/stage-[^/]*/[^/]*' | head -n 1)
  if [ -n "$_btu_stage" ] && [ "$_btu_stage" != "$CONDA_PREFIX" ] &&
    [ "$(readlink "$_btu_stage" 2>/dev/null)" != "$CONDA_PREFIX" ]; then
    # A real directory there was written by a program that ran before the link
    # existed. In practice that is fontconfig's cache under the prefix. Set it
    # aside rather than link over it, because `ln` would nest the link inside it.
    if [ -d "$_btu_stage" ] && [ ! -L "$_btu_stage" ]; then
      rm -rf "$_btu_stage.stray" 2>/dev/null || true
      mv "$_btu_stage" "$_btu_stage.stray" 2>/dev/null || _btu_stage=""
    fi
    if [ -n "$_btu_stage" ]; then
      mkdir -p "$(dirname "$_btu_stage")" 2>/dev/null || true
      ln -sfn "$CONDA_PREFIX" "$_btu_stage" 2>/dev/null || true
    fi
  fi
fi
unset _btu_dir _btu_name _btu_link _btu_xvfb _btu_stage
