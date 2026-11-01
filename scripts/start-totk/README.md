# TotK Setup launcher

`Start_TotK.exe` opens the TotK Setup GUI in Brazilian Portuguese with the base game, update, keys file, game language, and install folder prefilled. It does not start the installation until the user clicks **Iniciar**.

The launcher derives absolute paths from its own folder. The supported layouts are:

```text
<Merlin game folder>\
  Start_TotK.exe
  game\
    The Legend of Zelda Tears of the Kingdom [0100F2C0115B6000][v0].xci
    sxs-the_legend_of_zelda_tears_of_the_kingdom_v720896.nsp
    keys\prod.keys
  TotK-Setup-0.2.8-windows\   # optional if the setup package is nested
```

The setup package can also be unpacked directly into the launcher folder. When the keys file is under `game\keys`, the launcher finds a single `prod.keys` by filename. It never reads or copies the keys file itself. Users provide their own game dump and keys.

By default, `build.ps1` writes `Start_TotK.exe` into the setup package folder. Pass `-LauncherRoot` to write it to a separate Merlin game folder:

```powershell
.\build.ps1 -LauncherRoot 'X:\Merlin Games\The Legend of Zelda Tears of the Kingdom'
```

The installer destination is `<launcher folder>\TotK-Installed`.