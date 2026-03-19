# dei_hud

HUD con glassmorphism: vitales, velocimetro, sistemas de vehiculo y mas.

## Requisitos

- FiveM Server
- ESX o QBCore

## Instalacion

1. Descarga el recurso
2. Coloca la carpeta `dei_hud` en tu directorio `resources`
3. Agrega `ensure dei_hud` a tu `server.cfg`
4. Configura `config.lua` a tu gusto

## Configuracion

Edita `config.lua` para ajustar los indicadores de vitales, velocimetro, minimapa y efectos visuales.

## Ecosistema Dei

Este recurso forma parte del ecosistema Dei. Funciona de forma independiente, pero al usarlo junto a otros recursos Dei comparte:

- Sistema de temas (dark, midnight, neon, minimal)
- Modo claro/oscuro
- Preferencias sincronizadas via KVP

## Estructura

```
dei_hud/
├── client/
│   ├── framework.lua
│   ├── hud.lua
│   ├── minimap.lua
│   └── vehicle.lua
├── html/
│   ├── index.html
│   └── assets/
│       ├── css/
│       │   ├── styles.css
│       │   └── themes.css
│       ├── js/
│       │   └── app.js
│       ├── img/
│       │   └── logo.png
│       └── fonts/
│           ├── Gilroy-Light.otf
│           └── Gilroy-ExtraBold.otf
├── config.lua
└── fxmanifest.lua
```

## Licencia

MIT License - Dei
