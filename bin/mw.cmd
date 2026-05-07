@echo off
REM Markwright CLI shim — opens a markdown file in the installed Markwright app.
REM During development, run `npm run dev` first; this shim targets the installed exe.
SET "MW_EXE=%LOCALAPPDATA%\Programs\Markwright\Markwright.exe"
IF NOT EXIST "%MW_EXE%" (
  SET "MW_EXE=%PROGRAMFILES%\Markwright\Markwright.exe"
)
IF NOT EXIST "%MW_EXE%" (
  echo Markwright is not installed. Build and install it first ^(npm run package^).
  exit /b 1
)
start "" "%MW_EXE%" %*
