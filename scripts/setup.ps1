# image-ocr 环境体检/修复（Windows PowerShell）
param([switch]$Repair)
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$skill = Split-Path -Parent $here
Write-Host "==== image-ocr 环境体检（Windows） ===="
$ok = $true

function Find-Exe($names, $globs) {
  foreach ($g in $globs) { $h = Get-ChildItem $g -ErrorAction SilentlyContinue | Select-Object -First 1; if ($h) { return $h.FullName } }
  foreach ($n in $names) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { return $c.Source } }
  return $null
}
$node = Find-Exe @('node.exe','node') @("$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\node\bin\node.exe")
if ($node) { Write-Host "✅ node: $node" } else { Write-Host "❌ node：未找到（安装 Node.js 18+）"; $ok = $false }
$py = Find-Exe @('python.exe','python3.exe','python','python3') @("$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\python\python.exe","$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\python\bin\python3.exe")
if ($py) { Write-Host "✅ python: $py" } else { Write-Host "❌ python：未找到（安装 Python 3.8+）"; $ok = $false }

$tess = @("$here\node_modules\tesseract.js\package.json") + (Get-ChildItem "$env:USERPROFILE\.cache\codex-runtimes\*\dependencies\node\node_modules\tesseract.js\package.json" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
$tessHit = $tess | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($tessHit) { Write-Host "✅ tesseract.js: $tessHit" } else { Write-Host "❌ tesseract.js：未找到（$PSCommandPath -Repair）"; $ok = $false }

$pillow = $false
if ($py) { & $py -c "import PIL" 2>$null; if ($LASTEXITCODE -eq 0) { $pillow = $true } }
if ($pillow) { Write-Host "✅ Pillow: 已安装" } else { Write-Host "❌ Pillow：未安装" ; $ok = $false }

$models = Get-ChildItem "$skill\assets\tessdata\*.traineddata" -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName }
if ($models) { Write-Host "✅ 语言模型: $($models -join ', ')" } else { Write-Host "⚠️ 语言模型：无（运行 ocr_image --download-langs chi_sim,eng）" }
$pt = Find-Exe @('pdftoppm.exe','pdftoppm') @()
if ($pt) { Write-Host "✅ pdftoppm: 可用（多页 PDF）" } else { Write-Host "⚠️ pdftoppm：未安装（多页 PDF 仅第 1 页；安装 poppler 并加入 PATH）" }

if ($Repair) {
  Write-Host "---- 补救 ----"
  if (-not $tessHit -and $node) { Push-Location $here; & npm --no-fund --no-audit install tesseract.js@7; Pop-Location }
  if (-not $pillow -and $py) { & $py -m pip install Pillow }
  if (-not $models) { & $node "$here\ocr_image.js" --download-langs chi_sim,eng }
}
if ($ok) { Write-Host "体检通过：可运行 .\ocr_image.ps1 --doctor 做微型自检" } else { Write-Host "体检发现缺项，请按提示处理（或 .\setup.ps1 -Repair）"; exit 1 }
