$env:binPath = "$pwd\common\bin\"
$ErrorActionPreference = "Stop"
function Down
{
    npm stop
    Remove-Item -Recurse -Force -ErrorAction Ignore $pwd\stateVolumes\*
}

function Prepare-Network
{
    npm run prestart
}
function Restart
{
    Down
    $env:channelName = "allchannel"
    npm start
}
function Deploy-Chaincode
{
    npm run poststart
}



if ($args[0] -eq $null)
{
    Restart
}
else
{
    $sb = (get-command $args[0] -CommandType Function).ScriptBlock
    Invoke-Command -scriptblock $sb
}

