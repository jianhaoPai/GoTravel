const api = require('../../services/api');

const app = getApp();

Page({
  data: {
    placeId: '',
    place: {},
    comments: []
  },

  onLoad(options) {
    this.setData({ placeId: options.id });
    this.loadPlace(options.id);
  },

  loadPlace(placeId) {
    api.getPlace(placeId, app.globalData.activeTripId).then((data) => {
      const statusMap = {
        must: '必去',
        want: '想去',
        maybe: '备选'
      };

      this.setData({
        place: Object.assign({}, data.place, {
          statusText: statusMap[data.place.status] || '想去'
        }),
        comments: data.comments
      });
    });
  },

  toggleWant() {
    api.toggleReaction(this.data.placeId).then((data) => {
      this.setData({ place: Object.assign({}, this.data.place, data.place) });
      wx.showToast({ title: '已记录' });
    });
  },

  openLocation() {
    const place = this.data.place;

    wx.openLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      address: place.address,
      scale: 16
    });
  }
});
