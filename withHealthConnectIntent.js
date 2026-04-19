const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectIntent(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults.manifest;
    
    // 1. Injetar a Activity-Alias obrigatória do Android 14
    if (!androidManifest.application[0]['activity-alias']) {
        androidManifest.application[0]['activity-alias'] = [];
    }
    androidManifest.application[0]['activity-alias'].push({
        $: {
            'android:name': 'ViewPermissionUsageActivity',
            'android:exported': 'true',
            'android:targetActivity': '.MainActivity',
            'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [{
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        }],
    });

    // 2. Injetar o Rationale na MainActivity
    if (!androidManifest.application[0].activity[0]['intent-filter']) {
        androidManifest.application[0].activity[0]['intent-filter'] = [];
    }
    androidManifest.application[0].activity[0]['intent-filter'].push({
        action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
    });

    return config;
  });
};
