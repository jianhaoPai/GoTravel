const config = require('./config/env');

App({
  onLaunch(options) {
    if (wx.cloud && config.cloudEnvId) {
      wx.cloud.init({
        env: config.cloudEnvId,
        traceUser: true
      });

      this.globalData.cloudReady = true;
    }

    if (options && options.query && options.query.tripId) {
      this.globalData.activeTripId = options.query.tripId;
    } else if (config.cloudEnvId) {
      this.globalData.activeTripId = wx.getStorageSync('activeTripId') || '';
    } else {
      this.globalData.activeTripId = 'trip-demo-shanghai';
    }
  },

  globalData: {
    activeTripId: '',
    cloudReady: false,
    user: {
      openid: 'local-user',
      nickName: '我',
      avatarColor: '#0F766E'
    }
  }
});
