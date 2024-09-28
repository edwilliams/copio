import IDB from 'idb-keyval'

export const removeFileExt = str => {
  return /.png|.jpg|.jpeg|.pdf/.test(str) ? str.split('.')[0] : str
}

export const getScreen = () => window.location.hash.split('#/')[1]

export const setScreen = (data, opts = {}) => {
  const str = Array.isArray(data) ? data.join('/') : typeof data === 'string' ? data : ''

  if (opts.delay) {
    setTimeout(() => {
      window.location.hash = `#/${str}`
    }, opts.delay)
  } else {
    window.location.hash = `#/${str}`
  }
}

export const removeServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const cacheNames = await caches.keys()

    await Promise.all(registrations.map(registration => registration.unregister()))
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
  }
}

export const toDataURL = url => {
  return new Promise(resolve => {
    var xhr = new XMLHttpRequest()
    xhr.onload = function () {
      var reader = new FileReader()
      reader.onloadend = function () {
        resolve(reader.result)
      }
      reader.readAsDataURL(xhr.response)
    }
    xhr.open('GET', url)
    xhr.responseType = 'blob'
    xhr.send()
  })
}
