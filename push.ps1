# Load .env variables safely
if (-not (Test-Path ".env")) {
    Write-Error ".env file not found."
    exit 1
}

Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), "Process")
    }
}

$token = [Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "Process")
$username = [Environment]::GetEnvironmentVariable("GITHUB_USERNAME", "Process")
$repo = [Environment]::GetEnvironmentVariable("GITHUB_REPO", "Process")
if (-not $repo) { $repo = "arkuzo-site" }

if (-not $token -or $token.Trim() -eq "") {
    Write-Error "GITHUB_TOKEN is missing in .env."
    exit 1
}

if (-not $username -or $username.Trim() -eq "") {
    Write-Error "GITHUB_USERNAME is missing in .env."
    exit 1
}

if ($token.StartsWith("github_pat_")) {
    $remoteUrl = "https://x-access-token:${token}@github.com/${username}/${repo}.git"
} else {
    $remoteUrl = "https://${token}@github.com/${username}/${repo}.git"
}

git remote remove origin 2>$null
git remote add origin $remoteUrl
git -c credential.helper= push -u origin main

if ($LASTEXITCODE -eq 0) {
    # Strip credentials from remote URL
    git remote set-url origin "https://github.com/$username/$repo.git"
    Write-Host "Successfully pushed to https://github.com/$username/$repo"
} else {
    git remote set-url origin "https://github.com/$username/$repo.git"
    Write-Error "Push failed. Please check token permissions."
}
