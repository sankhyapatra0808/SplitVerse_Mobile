const { withMainActivity } = require("@expo/config-plugins");

const SECURE_MARKER = "SplitVerse: secure screenshots while privacy state loads";

function addAndroidSecureWindowFlag(contents, language) {
  if (contents.includes(SECURE_MARKER)) {
    return contents;
  }

  if (language === "java") {
    const superOnCreate = /super\.onCreate\((?:null|savedInstanceState)\);/;
    if (!superOnCreate.test(contents)) {
      throw new Error(
        "SplitVerse secure-window plugin could not find MainActivity.onCreate().",
      );
    }

    return contents.replace(
      superOnCreate,
      (match) => `${match}\n\n    // ${SECURE_MARKER}\n    // Start secure by default. expo-screen-capture clears this flag when\n    // the user explicitly disables Privacy Mode.\n    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);`,
    );
  }

  const superOnCreate = /super\.onCreate\((?:null|savedInstanceState)\)/;
  if (!superOnCreate.test(contents)) {
    throw new Error(
      "SplitVerse secure-window plugin could not find MainActivity.onCreate().",
    );
  }

  return contents.replace(
    superOnCreate,
    (match) => `${match}\n\n    // ${SECURE_MARKER}\n    // Start secure by default. expo-screen-capture clears this flag when\n    // the user explicitly disables Privacy Mode.\n    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)`,
  );
}

module.exports = function withSplitVerseSecureWindow(config) {
  return withMainActivity(config, (configWithActivity) => {
    configWithActivity.modResults.contents = addAndroidSecureWindowFlag(
      configWithActivity.modResults.contents,
      configWithActivity.modResults.language,
    );

    return configWithActivity;
  });
};

module.exports.addAndroidSecureWindowFlag = addAndroidSecureWindowFlag;
