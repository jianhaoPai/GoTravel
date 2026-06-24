const api = require('../../services/api');

const app = getApp();

Page({
  data: {
    trip: {},
    members: [],
    places: [],
    filteredPlaces: [],
    markers: [],
    center: {
      latitude: 31.2304,
      longitude: 121.4737
    },
    scale: 12,
    categories: ['全部', '景点', '餐厅', '街区', '购物'],
    activeCategory: '全部'
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
        members: data.members,
        places: data.places,
        center: data.trip.center || this.data.center
      });
      this.applyFilters();
    });
  },

  applyFilters() {
    const filteredPlaces = this.data.places.filter((place) => (
      this.data.activeCategory === '全部' || place.category === this.data.activeCategory
    ));
    const markers = filteredPlaces.map((place, index) => ({
      id: index + 1,
      placeId: place._id,
      latitude: place.latitude,
      longitude: place.longitude,
      title: place.name,
      width: 34,
      height: 34,
      callout: {
        content: `${place.name} · ${place.creatorName}`,
        display: 'BYCLICK',
        padding: 8,
        borderRadius: 6
      },
      label: {
        content: place.creatorName.slice(0, 1),
        color: '#ffffff',
        fontSize: 12,
        anchorX: -8,
        anchorY: -30,
        bgColor: place.creatorColor,
        borderRadius: 14,
        padding: 5
      }
    }));

    this.setData({ filteredPlaces, markers });
  },

  selectCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.category }, () => this.applyFilters());
  },

  onMarkerTap(event) {
    const marker = this.data.markers.find((item) => item.id === event.markerId);
    if (marker) {
      wx.navigateTo({ url: `/pages/place/place?id=${marker.placeId}` });
    }
  },

  openPlace(event) {
    wx.navigateTo({ url: `/pages/place/place?id=${event.currentTarget.dataset.id}` });
  },

  addPlace() {
    wx.chooseLocation({
      success: (res) => {
        this.collectPlaceMeta(res);
      },
      fail: () => wx.showToast({ title: '未选择地点', icon: 'none' })
    });
  },

  collectPlaceMeta(location) {
    wx.showActionSheet({
      itemList: ['景点', '餐厅', '街区', '购物'],
      success: (categoryRes) => {
        const category = ['景点', '餐厅', '街区', '购物'][categoryRes.tapIndex];
        wx.showModal({
          title: '地点备注',
          editable: true,
          placeholderText: '例如：晚上去、适合拍照、朋友强推',
          success: (noteRes) => {
            api.savePlace({
              name: location.name || '新地点',
              address: location.address || '地图选点',
              latitude: location.latitude,
              longitude: location.longitude,
              category,
              note: noteRes.content || '从地图添加的候选点',
              status: 'want'
            }).then(() => {
              wx.showToast({ title: '已添加' });
              this.loadData();
            });
          }
        });
      }
    });
  }
});
