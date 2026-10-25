$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
$testDbDir = Join-Path $PSScriptRoot "..\data\test_db"
if (-not (Test-Path $testDbDir)) {
    New-Item -ItemType Directory -Force -Path $testDbDir | Out-Null
}

$mongodPath = "C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe"
$mongod = Start-Process -FilePath $mongodPath -ArgumentList "--port 27018 --dbpath `"$testDbDir`" --bind_ip 127.0.0.1" -PassThru

try {
    Start-Sleep -Seconds 2
    node (Join-Path $PSScriptRoot "run-tests.js")
}
finally {
    if ($mongod -and -not $mongod.HasExited) {
        Stop-Process -Id $mongod.Id -Force
    }
}
