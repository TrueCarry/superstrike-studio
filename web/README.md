# SuperStrike Studio Web

A browser version of [SuperStrike Studio](https://github.com/Adhamura/superstrike-studio) for the
Logitech PRO X2 / X3 SUPERSTRIKE, using WebHID. React, React Router (hash routes), Vite, Bun.

Pages: HITS (actuation, rapid trigger, haptics, presets, HITS codes, test pad), Buttons (normal and
DPI-shift layer, key recording), Sensor (DPI stages, polling rate, angle snap, surface mode, scroll
filter, power), Profiles (onboard profiles, control mode, backup and restore) and Device.

## Run

```sh
bun install
bun run dev      # http://127.0.0.1:8017
bun run build    # static site in dist/, works from any folder
bun test         # profile sector, actions, directory and HITS code tests
```

Needs Chrome, Edge or another Chromium browser, opened in a normal window (not an embedded preview).
On Linux your user needs access to the receiver:

```sh
echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Safety

- Every sector write sets the CRC and is verified by reading it back.
- A whole-memory backup is stored in the browser before the first save of a session and before
  every restore (Profiles page).
- Saving a profile where no button sends a left click asks first.
- A mouse that never saved profiles runs on its read-only factory profile. The app shows that state,
  and the first save creates the onboard profiles like G HUB does, after a confirmation.

`public/hid-test.html` is the original single-file HITS test page.
