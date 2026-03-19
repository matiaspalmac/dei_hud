local minimapReady = false
local minimapScaleform = 0

CreateThread(function()
    minimapScaleform = RequestScaleformMovie('minimap')
    if not minimapScaleform then return end

    -- Init bigmap toggle to set proper aspect ratio
    SetRadarBigmapEnabled(true, false)
    Wait(0)
    SetRadarBigmapEnabled(false, false)

    minimapReady = true

    while true do
        Wait(0)
        if minimapReady then
            BeginScaleformMovieMethod(minimapScaleform, 'SETUP_HEALTH_ARMOUR')
            ScaleformMovieMethodAddParamInt(3)
            EndScaleformMovieMethod()

            -- Circle minimap support
            if Config.CircleMap then
                SetMinimapClipType(1) -- circle
            else
                SetMinimapClipType(0) -- square/default
            end
        end
    end
end)

-- Cleanup on resource stop
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    DisplayRadar(true)
    DisplayHud(true)
    SetMinimapClipType(0)
end)
