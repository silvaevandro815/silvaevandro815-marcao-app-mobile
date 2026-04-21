const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidForegroundService(config, props) {
  const foregroundServiceType = props?.foregroundServiceType || 'dataSync';

  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const mainApplication = androidManifest.application[0];

    if (mainApplication.service) {
      mainApplication.service.forEach((service) => {
        const serviceName = service.$['android:name'];
        
        // Atribuir tipo de serviço para o TaskService do Expo e qualquer outro serviço de background sync
        if (
          serviceName === 'expo.modules.taskmanager.TaskService' ||
          serviceName.includes('BackgroundFetch')
        ) {
          console.log(`[Plugin] Atribuindo foregroundServiceType (${foregroundServiceType}) a: ${serviceName}`);
          service.$['android:foregroundServiceType'] = foregroundServiceType;
        }
      });
    }

    return config;
  });
};
