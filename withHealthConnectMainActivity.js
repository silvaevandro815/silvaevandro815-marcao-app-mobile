const { withMainActivity } = require('@expo/config-plugins');

module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, async (config) => {
    let contents = config.modResults.contents;

    const importStatement = "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
    if (!contents.includes(importStatement)) {
      contents = contents.replace(
        "import android.os.Bundle",
        "import android.os.Bundle\n" + importStatement
      );
    }

    const initCode = "HealthConnectPermissionDelegate.setPermissionDelegate(this)";
    if (!contents.includes(initCode)) {
      // Tenta substituir no padrão Expo 50+ (onCreate com savedInstanceState ou null)
      contents = contents.replace(
        "super.onCreate(null)",
        "super.onCreate(null)\n    " + initCode
      );
      contents = contents.replace(
        "super.onCreate(savedInstanceState)",
        "super.onCreate(savedInstanceState)\n    " + initCode
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
