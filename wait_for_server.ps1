for ($i = 0; $i -lt 30; $i++) {
    $result = netstat -ano | Select-String "127.0.0.1:5000"
    if ($result) {
        Write-Host "READY after $i seconds"
        break
    }
    Write-Host "Waiting... $i"
    Start-Sleep 1
}
if (-not $result) {
    Write-Host "TIMEOUT - server not ready after 30s"
}
