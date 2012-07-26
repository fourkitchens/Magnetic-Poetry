({
  paths: {
    jquery: 'vendor/jquery-1.7.2.min',
    jqueryui: 'vendor/jquery-ui-1.8.18.custom.min',
    touchpunch: 'vendor/jquery-ui-touch-punch/jquery.ui.touch-punch',
    underscore: 'vendor/underscore-min',
    backbone: 'vendor/backbone-min',
    moment: 'vendor/moment.min'
  },
  appDir: "../",
  baseUrl: "js",
  dir: "../../drupo",
  fileExclusionRegExp: /^node_modules|server$/,
  modules: [
    {
      name: "main",
      exclude: ['backbone', 'underscore']
    }
  ]
})
