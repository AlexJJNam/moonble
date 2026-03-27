# Figma 에셋 다운로드 스크립트 (PowerShell)
# 실행: powershell -ExecutionPolicy Bypass -File download-assets.ps1

$baseUrl = "https://www.figma.com/api/mcp/asset"
$assetsDir = "$PSScriptRoot\assets"

$assets = @{
  # index.html
  "hero-bg.png"              = "495157d5-c952-4c11-90e1-26e5e76f048c"
  "hero-sparkle.png"         = "bbac59f3-6a5d-4b2d-94f7-1b67ed6deb40"
  "hero-char.png"            = "cb593c1d-f640-43be-83ef-341fcb7bed45"
  "hero-group126.png"        = "138201ca-24f7-417c-90da-bb2ccc790ebe"
  "intro-ai-icon.png"        = "2ad893b3-7e83-43ad-af64-4cea4f7ddbfd"
  "schedule-icon.png"        = "4dd6c73a-660d-44a9-8a50-3bc2a85afd4b"
  "intro-icon2.png"          = "5aab5144-695e-4d70-b917-2f29977b0fa3"
  "stars-sprite.png"         = "ffc978fa-38d4-4067-81f2-1cba0dafac4e"
  "choose-bg.png"            = "c3f8cac6-a77a-4716-80bb-b4d0aea6b732"
  "choose-char.png"          = "4aecdbe4-fb26-4105-96ec-26cb79a9672f"
  "choose-stroke-1.png"      = "65b64079-2d2c-4ce7-bf1e-6e054f4bbe8d"
  "choose-stroke-2.png"      = "1fbbe36e-6ddf-43cc-9e05-cef8e7e4dca6"
  "icon-bullet-a.png"        = "ba89245b-ac41-4251-b826-b67ce74a9ed4"
  "icon-bullet-b.png"        = "893263eb-0f96-4f16-8f36-3f37247fdeec"
  "icon-bullet-c.png"        = "71824265-e0bd-4997-852c-c7edcbbb4dac"
  "caution-icon.png"         = "cc310df6-6830-4459-b61e-e9fa5c5fe847"
  # style.css
  "guide-bg.png"             = "0dd37192-1c7b-4235-8dde-8aaffb75346d"
  # pocket-a.html
  "pocket-a-header.png"      = "a87ea8d2-aca0-4b2e-978f-f592d3a85fbe"
  "pocket-a-bullet.png"      = "d17fff10-ff67-4268-999c-29078e9a11f2"
  "pocket-a-check.png"       = "0ae09529-a5ee-440c-a6fa-38dc54e0fda8"
  "pocket-a-caution.png"     = "f30714f9-7f6e-49b7-b19d-363ae202c63e"
  "pocket-a-footer-bullet.png" = "e2ec62b2-3d0b-4ce7-9341-95802f32c202"
  # pocket-b.html
  "pocket-b-header.png"      = "d7133c87-a5cd-4059-8167-30a9c6efad24"
  "pocket-b-bullet.png"      = "153e7244-c8f3-4b22-b13a-063331bed531"
  "pocket-b-check.png"       = "f63dd767-b806-4d4b-8a95-ab5e58f55993"
  "pocket-b-caution.png"     = "e9cdcd32-815a-4fe4-ab67-e1893e8c4ca0"
  "pocket-b-footer-bullet.png" = "326cec03-2b00-408d-a0c6-725f22004f82"
  # pocket-c.html
  "pocket-c-header.png"      = "aebcfa6d-1900-49ad-8342-ed04b9085817"
  "pocket-c-bullet.png"      = "9c3cbefb-f53f-4d4c-83a5-8e746be35631"
  "pocket-c-check.png"       = "20d4bb53-ac73-45e8-b630-9f88fa959a64"
  "pocket-c-caution.png"     = "1d3652ab-3902-417d-9c98-1bded4197c3f"
  "pocket-c-footer-bullet.png" = "5627a65d-4a88-4365-8403-7b2fca276720"
}

foreach ($name in $assets.Keys) {
  $uuid = $assets[$name]
  $url  = "$baseUrl/$uuid"
  $dest = "$assetsDir\$name"
  Write-Host "Downloading $name ..."
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

Write-Host "Done. $($assets.Count) files saved to assets/"
