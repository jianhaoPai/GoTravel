const api = require('../../services/api');
const geo = require('../../utils/geo');

const app = getApp();

Page({
  data: {
    trip: {},
    places: [],
    routeName: '第一天路线',
    routePlaceIds: [],
    routePlaces: [],
    candidatePlaces: [],
    stats: {
      distanceText: '0 m',
      durationText: '0 分钟'
    },
    dragIndex: -1,
    dragStartY: 0
  },

  onShow() {
    if (!app.globalData.activeTripId) {
      wx.showToast({
        title: '先创建旅行',
        icon: 'none'
      });
      wx.switchTab({ url: '/pages/home/home' });
      return;
    }

    this.loadData();
  },

  loadData() {
    api.listTripData(app.globalData.activeTripId).then((data) => {
      this.setData({
        trip: data.trip,
        places: data.places,
        routeName: data.routePlan.name,
        routePlaceIds: data.routePlan.placeIds || []
      });
      this.rebuildRoute();
    });
  },

  rebuildRoute() {
    const { places, routePlaceIds } = this.data;
    const routePlaces = routePlaceIds
      .map((id) => places.find((place) => place._id === id))
      .filter(Boolean);
    const candidatePlaces = places.map((place) => Object.assign({}, place, {
      inRoute: routePlaceIds.indexOf(place._id) >= 0
    }));

    this.setData({
      routePlaces,
      candidatePlaces,
      stats: geo.routeStats(routePlaces)
    });
  },

  togglePlace(event) {
    const id = event.currentTarget.dataset.id;
    const routePlaceIds = this.data.routePlaceIds.slice();
    const index = routePlaceIds.indexOf(id);

    if (index >= 0) {
      routePlaceIds.splice(index, 1);
    } else {
      routePlaceIds.push(id);
    }

    this.setData({ routePlaceIds }, () => this.rebuildRoute());
  },

  selectAll() {
    this.setData({
      routePlaceIds: this.data.places.map((place) => place._id)
    }, () => this.rebuildRoute());
  },

  clearRoute() {
    this.setData({ routePlaceIds: [] }, () => this.rebuildRoute());
  },

  swap(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= this.data.routePlaceIds.length || fromIndex === toIndex) return;

    const routePlaceIds = this.data.routePlaceIds.slice();
    const moved = routePlaceIds.splice(fromIndex, 1)[0];
    routePlaceIds.splice(toIndex, 0, moved);
    this.setData({ routePlaceIds }, () => this.rebuildRoute());
  },

  moveUp(event) {
    this.swap(event.currentTarget.dataset.index, event.currentTarget.dataset.index - 1);
  },

  moveDown(event) {
    this.swap(event.currentTarget.dataset.index, event.currentTarget.dataset.index + 1);
  },

  startDrag(event) {
    this.setData({
      dragIndex: event.currentTarget.dataset.index,
      dragStartY: event.touches[0].clientY
    });
  },

  moveDrag(event) {
    const delta = event.touches[0].clientY - this.data.dragStartY;
    if (Math.abs(delta) < 48) return;

    const nextIndex = delta > 0 ? this.data.dragIndex + 1 : this.data.dragIndex - 1;
    this.swap(this.data.dragIndex, nextIndex);
    this.setData({
      dragIndex: nextIndex,
      dragStartY: event.touches[0].clientY
    });
  },

  endDrag() {
    this.setData({ dragIndex: -1, dragStartY: 0 });
  },

  saveRoute() {
    api.saveRoute(this.data.trip._id, this.data.routePlaceIds).then(() => {
      wx.showToast({ title: '路线已保存' });
    });
  },

  openNavigation() {
    const first = this.data.routePlaces[0];
    if (!first) return;

    wx.openLocation({
      latitude: first.latitude,
      longitude: first.longitude,
      name: first.name,
      address: first.address,
      scale: 16
    });
  }
});
