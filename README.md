# Offline sandbox (orphan branch)

Built 2026-10-10T18:59:03Z from commit `009f233` for platform `linux-64`.
`pixi.lock` sha256 `8e3b2bba68b89a59be9620f5b114b1dcb45d5bcc0a6c1297796a98d23f37f4c0`.

The verified self-bootstrap binary is stored at `.pixi-sandbox/tools/linux-64/pixi-sandbox`. The branch root intentionally contains documentation only.

| env | platform | packed | unpacked | files |
| --- | --- | ---: | ---: | ---: |
| `browser` | linux-64 | 106.3 MiB | 403.0 MiB | 114 |
| `default` | linux-64 | 3.7 MiB | 11.2 MiB | 7 |

## Restore on the disconnected machine

```bash
./.pixi-sandbox/tools/linux-64/pixi-sandbox doctor --branch-location . --verify
./.pixi-sandbox/tools/linux-64/pixi-sandbox restore --branch-location . --output-path <project> --force
# then, from <project> with no network, use pixi as the sole entrypoint:
pixi install --frozen --offline
pixi run --frozen -- cargo build --offline
```

Every manifest blob is verified before it is written into the working tree.
