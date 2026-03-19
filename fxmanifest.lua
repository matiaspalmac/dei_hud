fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Dei'
description 'Glassmorphism HUD for FiveM'
version '1.0'

server_scripts {
    'server/main.lua',
}

client_scripts {
    'config.lua',
    'client/framework.lua',
    'client/postals.lua',
    'client/vehicle.lua',
    'client/hud.lua',
    'client/minimap.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/assets/js/app.js',
    'html/assets/img/*.png',
    'html/assets/css/themes.css',
    'html/assets/css/styles.css',
    'html/assets/fonts/*.otf',
}

exports {
    'toggleHud',
    'isHudVisible',
    'showNotification',
    'ProgressBar',
    'CancelProgress',
    'CircularProgress',
    'AddEffect',
    'RemoveEffect',
}
