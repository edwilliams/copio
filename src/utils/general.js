import IDB from 'idb-keyval'

export const removeFileExt = str => {
  return /.png|.jpg|.jpeg|.pdf/.test(str) ? str.split('.')[0] : str
}

export const mergeArraysByKey = ({ a, b, key }) => {
  const aKeys = a.map(obj => obj[key])
  const _b = b.filter(obj => !aKeys.some(id => id === obj[key]))
  return a.concat(_b)
}

export const removeAllSongs = () => {
  return new Promise((resolve, reject) => {
    IDB.set('songs', []).then(resolve).catch(reject)
  })
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
    for (let registration of registrations) {
      registration.unregister()
    }
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
