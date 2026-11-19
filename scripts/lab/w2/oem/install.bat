@echo off
rem Poste W2 « agence régionale » : exécuté une fois, à la fin de l'installation automatique.
rem Volontairement absent : le certificat interne du lab (on observe ce que voit l'utilisateur).
setlocal
set LOG=C:\OEM\install.log
echo [%date% %time%] debut >> "%LOG%"

rem Chrome entreprise (installation silencieuse, réseau disponible pendant l'installation).
set MSI=%TEMP%\chrome64.msi
curl.exe -fsSL -o "%MSI%" https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] ECHEC telechargement Chrome >> "%LOG%"
) else (
  msiexec /i "%MSI%" /qn /norestart >> "%LOG%" 2>&1
  echo [%date% %time%] Chrome msiexec code %errorlevel% >> "%LOG%"
  del /q "%MSI%"
)

rem Mise à l'échelle 125 %% (120 dpi), prise en compte à la prochaine ouverture de session.
reg add "HKCU\Control Panel\Desktop" /v LogPixels /t REG_DWORD /d 120 /f >> "%LOG%" 2>&1
reg add "HKCU\Control Panel\Desktop" /v Win8DpiScaling /t REG_DWORD /d 1 /f >> "%LOG%" 2>&1

echo [%date% %time%] fin >> "%LOG%"
endlocal
