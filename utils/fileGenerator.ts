import { BuildContext, TargetArch, OutputType } from '../types';

/**
 * Creates a "Polyglot" file. 
 * This is a valid Batch script that contains C# code.
 * When executed, it calls the C# compiler on ITSELF to generate the .exe.
 * This is the only way to generate a "real" EXE client-side without a WASM compiler.
 */
export const generateSelfCompilingScript = (ctx: BuildContext): string => {
  const { metadata, config, sourceCode } = ctx;

  const safeName = metadata.projectName.replace(/[^a-zA-Z0-9_-]/g, '');
  const targetFlag = config.outputType === OutputType.WINDOWED ? '/target:winexe' : '/target:exe';
  const platformFlag = `/platform:${config.architecture}`;
  const optimizeFlag = config.enableOptimization ? '/optimize+' : '/optimize-';
  const unsafeFlag = config.allowUnsafe ? '/unsafe' : '';

  // Ensure necessary references for GUI apps
  const references = config.outputType === OutputType.WINDOWED 
    ? '/reference:System.Windows.Forms.dll /reference:System.Drawing.dll' 
    : '';

  return `/*
@echo off
cls
color 0A
echo ========================================================
echo   ExeForge Architect - Local Build Environment
echo ========================================================
echo.
echo  Target: ${safeName}.exe
echo  Arch:   ${config.architecture}
echo  Mode:   ${config.outputType}
echo.
echo  [1/3] Searching for .NET Framework Compiler...
set "CSC="
for /d %%i in (%windir%\\Microsoft.NET\\Framework64\\v*) do (
    if exist "%%i\\csc.exe" set "CSC=%%i\\csc.exe"
)
if not defined CSC (
    for /d %%i in (%windir%\\Microsoft.NET\\Framework\\v*) do (
        if exist "%%i\\csc.exe" set "CSC=%%i\\csc.exe"
    )
)

if not defined CSC (
    color 0C
    echo ERROR: C# Compiler (csc.exe) not found in Windows directory.
    echo Ensure .NET Framework is installed.
    pause
    goto :eof
)

echo  [2/3] Compiler found at:
echo        %CSC%
echo.
echo  [3/3] Compiling source code...
echo.

"%CSC%" /nologo /out:"${safeName}.exe" ${targetFlag} ${platformFlag} ${optimizeFlag} ${unsafeFlag} ${references} "%~f0"

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [!] BUILD FAILED. Please check the source code errors above.
    echo.
    pause
    goto :eof
)

color 0A
echo.
echo  [+] BUILD SUCCESSFUL!
echo      File created: %~dp0${safeName}.exe
echo.
echo  You can now run your genuine application.
echo.
pause
del "%~f0" & exit
goto :eof
*/

${sourceCode}
`;
};

export const downloadArtifact = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
