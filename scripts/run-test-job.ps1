$url = "https://www.youtube.com/shorts/-4L1Tfv_fDs?feature=share"
$payload = @{ url = $url } | ConvertTo-Json

Write-Host "Submitting job for: $url"
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs" `
    -Method Post `
    -ContentType "application/json" `
    -Body $payload

Write-Host "Job Submitted Successfully!"
$jobId = $response.job.id
Write-Host "Job ID: $jobId"
Write-Host "Initial Stage: $($response.job.current_stage)"

# Poll job until finished
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    $poll = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/$jobId"
    $stage = $poll.job.current_stage
    $status = $poll.job.status
    Write-Host "[$i] Stage: $stage | Status: $status"
    
    if ($status -eq "completed" -or $status -eq "failed") {
        Write-Host "Final Job State:"
        $poll | ConvertTo-Json -Depth 6 | Write-Host
        break
    }
}
