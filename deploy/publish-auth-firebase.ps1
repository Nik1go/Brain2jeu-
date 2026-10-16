param([ValidateRange(1, 65535)][int]$SshPort = 22)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $projectDirectory 'artifacts\brain2jeu-auth-firebase.tar.gz'
$installer = Join-Path $PSScriptRoot 'install-release.sh'
$destination = 'jean@137.74.112.13'
foreach ($file in @($archive, $installer)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Fichier absent : $file" }
}
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$indexHtml = (& tar -xOf $archive './index.html') -join "`n"
if ($LASTEXITCODE -ne 0) { throw "Impossible de lire le portail dans l'archive." }
$assets = [regex]::Matches($indexHtml, '(?:src|href)="\./(assets/[^\"]+)"') | ForEach-Object { $_.Groups[1].Value }
if ($assets.Count -lt 2) { throw 'Archive inattendue : les fichiers JS et CSS ne sont pas identifiables.' }

Write-Host 'Transfert de Brain2jeu. Saisis ton mot de passe SSH quand le terminal le demande.'
& scp -o StrictHostKeyChecking=yes -P $SshPort $archive $installer "${destination}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw 'Transfert interrompu. Aucune installation lancee.' }

# Require the existing Brain2jeu installation, verify the transfer, then switch
# its release symlink. The installer retains earlier releases for rollback.
$remoteCommand = "set -e; test -L /var/www/brain2jeu/current || { echo 'Le chemin existant de Brain2jeu doit etre verifie.' >&2; exit 1; }; printf '%s  %s\n' '$archiveHash' '/tmp/brain2jeu-auth-firebase.tar.gz' | sha256sum -c -; sudo bash /tmp/install-release.sh /tmp/brain2jeu-auth-firebase.tar.gz"
Write-Host 'Installation. SSH puis sudo peuvent demander ton mot de passe.'
& ssh -o StrictHostKeyChecking=yes -p $SshPort -t $destination $remoteCommand
if ($LASTEXITCODE -ne 0) { throw 'Installation interrompue. Lis le message du serveur avant de reessayer.' }

Write-Host 'Verification de la version publique...'
$response = Invoke-WebRequest -Uri "https://brain2jeu.leofinance.fr/?deploy-check=$($archiveHash.Substring(0, 12))" -Headers @{ 'Cache-Control' = 'no-cache' } -UseBasicParsing
foreach ($asset in $assets) {
    if (-not $response.Content.Contains($asset)) { throw 'Le domaine renvoie une autre version : verifier le chemin du site dans Nginx.' }
}
Write-Host 'Le portail Firebase est publie sur https://brain2jeu.leofinance.fr/.' -ForegroundColor Green
