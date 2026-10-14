# image-ocr Windows（PowerShell）启动器：自动定位 node/python 后调用 ocr_image.js
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition

function Find-Exe($names, $globs) {
  foreach ($g in $globs) {
    $hit = Get-ChildItem $g -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  foreach ($n in $names) {
    $c = Get-Command $n -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
  }
  return $null
}

$node = Find-Exe @('node.exe','node') @("$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\node\bin\node.exe")
if (-not $node) { Write-Error "未找到 node：请安装 Node.js 18+，或确认 Codex 运行时缓存完整"; exit 1 }
$py = Find-Exe @('python.exe','python3.exe','python','python3') @("$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\python\python.exe","$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\python\bin\python3.exe")
if ($py) { $env:CODEX_PYTHON = $py }

& $node "$here\ocr_image.js" @args
exit $LASTEXITCODE
