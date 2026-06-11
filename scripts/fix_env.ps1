$envPath = "C:\Users\ross server tiny11\nexus-trading\.env"
$c = Get-Content $envPath -Raw
$c = $c -replace 'CORS_ORIGINS=.*', 'CORS_ORIGINS=http://localhost:3001,http://192.168.1.33:3001'
$c = $c -replace 'NEXT_PUBLIC_API_URL=.*', 'NEXT_PUBLIC_API_URL=http://192.168.1.33:8001'
$c = $c -replace 'NEXT_PUBLIC_WS_URL=.*', 'NEXT_PUBLIC_WS_URL=ws://192.168.1.33:8001'
Set-Content $envPath $c -NoNewline
Write-Host "=== .env corrige ==="
Get-Content $envPath | Select-String "CORS_ORIGINS|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_WS_URL"

# Frontend lit aussi .env.local parfois - on cree .env.local pour le build Next
$frontEnv = "C:\Users\ross server tiny11\nexus-trading\frontend\.env.local"
Set-Content $frontEnv "NEXT_PUBLIC_API_URL=http://192.168.1.33:8001`nNEXT_PUBLIC_WS_URL=ws://192.168.1.33:8001`n"
Write-Host "=== frontend/.env.local cree ==="
Get-Content $frontEnv
