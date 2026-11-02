const items = require('./items')

Component({
  data: { items, selected: 0, switching: false },
  pageLifetimes: {
    show() { this.syncSelected() },
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const route = pages.length ? `/${pages[pages.length - 1].route}` : items[0].path
      const selected = items.findIndex((item) => item.path === route)
      if (selected >= 0) this.setData({ selected })
    },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const target = items[index]
      if (!target || index === this.data.selected || this.data.switching) return

      this.setData({ selected: index, switching: true })
      wx.switchTab({
        url: target.path,
        fail: () => {
          this.syncSelected()
          wx.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => this.setData({ switching: false }),
      })
    },
  },
})
