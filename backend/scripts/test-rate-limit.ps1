
$url = "http://localhost:8080/api/auth/login"
$body = @{
    email    = "rate.limit.test@example.com"
    password = "password123"
} | ConvertTo-Json

Write-Host "Testing Rate Limit (Max 5 attempts)..."

for ($i = 1; $i -le 7; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        Write-Host "Attempt $i : Allowed (Status 200/401)"
    }
    catch {
        # Check if Exception.Response exists
        if ($_.Exception.Response) {
            $status = $_.Exception.Response.StatusCode.value__
            if ($status -eq 429) {
                Write-Host "Attempt $i : BLOCKED (429 Too Many Requests)"
                Write-Host "Rate Limiting is WORKING!"
                exit
            }
            else {
                Write-Host "Attempt $i : Status $status"
            }
        }
        else {
            Write-Host "Attempt $i : Error $($_.Exception.Message)"
        }
    }
}

Write-Error "Rate Limiting FAILED. Did not recieve 429."
