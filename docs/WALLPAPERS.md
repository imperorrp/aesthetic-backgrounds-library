# A world as your wallpaper

Every world in Vivarium can run behind your desktop or on your phone. This page gives the steps for the common wallpaper apps. Each app works a little differently, and their menus change between versions; if a step does not match what you see, look for the nearest option with the same name.

Everything starts in the studio's **Share** tab, with the world, seed and look you want on screen.

| You want | Use | It needs |
|---|---|---|
| A live desktop, always the newest engine | **Copy wallpaper link** | an internet connection when the wallpaper starts |
| A live desktop that works forever, offline | **Offline file (.html)** | nothing: the engine is inside the file (about 450 KB) |
| Wallpaper Engine (Steam) | **Wallpaper Engine (.zip)** | Wallpaper Engine |
| A still image | **Still at screen size**, or **Still, 1170 × 2532** for a phone | nothing |
| A phone that moves | **Live, 10 s video**, or the wallpaper link on the home screen | a video wallpaper app, or a browser |

## The wallpaper link

*Copy wallpaper link* gives a bare page (`wallpaper.html`) with the world full screen and nothing else. It runs at 30 frames a second and stops drawing when the page is hidden, so a covered desktop costs almost nothing. The whole configuration is in the link, so the same link always plays the same world.

You can add these to the end of the link:

| Parameter | Does |
|---|---|
| `&fps=60` | Frames per second (30 by default). Lower saves battery; 15 is still smooth for most worlds. |
| `&pr=1` | Pixel ratio. `1` draws at one pixel per screen point, which is much lighter on a 4K screen. |
| `&skip=600` | Simulate this many seconds before the first frame, so the world starts busy (up to 1800). |
| `&i=1` | Let the mouse wheel zoom and a drag pan. Off by default, so clicks go to your desktop. |

Open the link in a normal browser tab first to check it. Double-click for full screen.

## Windows

### Lively Wallpaper (free)

1. Install [Lively Wallpaper](https://www.rocksdanister.com/lively/) (also in the Microsoft Store).
2. Click **+** (Add Wallpaper).
3. Paste the wallpaper link into the URL box and confirm. Lively loads it as a web page.
4. Pick it in the library and choose the screen.

For the offline file instead, drag the downloaded `.html` file onto Lively's window, or choose it with **+** → *Open file*.

Lively pauses wallpapers when a full-screen app or game runs; you can change that in its settings (Performance).

### Wallpaper Engine (Steam)

1. In the studio, download **Wallpaper Engine (.zip)**.
2. Find the Wallpaper Engine folder: in Steam, right-click Wallpaper Engine → *Manage* → *Browse local files*.
3. Unzip the file into `projects\myprojects`, so you get `projects\myprojects\<name>\index.html` beside `project.json` and `preview.jpg`.
4. Restart Wallpaper Engine. The world shows up in your installed wallpapers.

The zip holds the offline file, so it needs no internet.

## macOS

### Plash (free)

1. Install [Plash](https://sindresorhus.com/plash) from the Mac App Store.
2. Click the Plash icon in the menu bar → **Add Website**.
3. Paste the wallpaper link and save.

For the offline file, add it as a local website: Plash accepts a `file://` path, or you can choose the file in the same dialog.

Plash can reload the page on a timer; leave that off, or the world starts over each time. Turn on *Browsing Mode* only if you want to use the `&i=1` zoom and pan.

## Linux

### KDE Plasma

1. Right-click the desktop → **Configure Desktop and Wallpaper**.
2. Click **Get New Plugins…** and search for a web or HTML wallpaper plugin. Several exist; install one.
3. Choose that plugin as the wallpaper type and give it the wallpaper link, or the path of the offline file.

### Other desktops

GNOME and most other desktops do not draw web pages as wallpaper by themselves. Use a still image, or a video wallpaper tool with the **Video loop** export.

## Phones

### Android

- **Moving.** Download **Live, 10 s video** (MP4 where the browser can record one) and set it with a video wallpaper app. Search the Play Store for "video live wallpaper"; most loop a video file.
- **Still.** Download **Still, 1170 × 2532** and set it in Settings → Wallpaper.
- **Alive, not a loop.** Open the wallpaper link in Chrome, then menu → **Add to Home screen**. It opens full screen and remembers its world. It is an app you open, not the wallpaper behind your icons.

### iPhone

- **Still.** Download **Still, 1170 × 2532** and set it from Photos.
- **Moving.** iOS does not take a video as a wallpaper directly. Turn the **Live, 10 s video** into a Live Photo with an app that converts videos to Live Photos, then set that.
- **Alive, not a loop.** Open the wallpaper link in Safari → Share → **Add to Home Screen**. Like on Android, it opens full screen and remembers its world.

## If something is wrong

- **It is blank.** Open the same link in a normal browser. If it works there, the app may block web content or JavaScript; check its settings. If it is blank there too, the link may be cut short: copy it again from the studio.
- **It uses too much power.** Add `&fps=15&pr=1` to the link. Wallpaper apps also have their own pause rules (on battery, when a window is maximized).
- **It starts empty.** Add `&skip=600`, so ten minutes have already happened when it appears.
- **It is always the same world.** That is the seed. Change it in the studio (the shuffle button, or **S**) and copy the link again.
