import settings from './settings'

const domainsApiUrl = settings.getDomainsApiUrl()

class Proxies {
  constructor () {
    chrome.proxy.onProxyError.addListener((details) => {
      console.error(`Proxy error: ${JSON.stringify(details)}`)
    })

    setInterval(() => {
      this.syncDatabaseWithRegistry()
    }, 60 * 60 * 1000 * 2)

    setInterval(() => {
      this.removeOutdatedBlockedDomains()
    }, 60 * 1000 * 60 * 60 * 2)
  }

  setProxy = (hostname) => {
    this.getBlockedDomains((domains) => {
      domains = this.excludeSpecialDomains(domains)
      chrome.storage.local.get(
        {
          blockedDomains: [],
        },
        (items) => {
          const blockedDomains = items.blockedDomains

          if (hostname) {
            const domain = blockedDomains.find(
              (element) => element.domain === hostname,
            )

            if (!domain) {
              blockedDomains.push({
                domain: hostname,
                timestamp: new Date().getTime(),
              })
            }
          }

          if (blockedDomains) {
            domains = domains.concat(blockedDomains.map((obj) => obj.domain))
          }

          chrome.storage.local.set(
            {
              blockedDomains,
            },
            () => {
              if (hostname) {
                console.log(
                  `Site ${hostname} has been added to set of blocked by DPI.`,
                )
              }
            },
          )
          this.setProxyAutoConfig(domains)
        },
      )
    })
  }

  getBlockedDomains = (callback) => {
    const db = window.censortracker.Database

    db.get('domains')
      .then(({ domains }) => {
        if (domains) {
          console.warn('Fetching domains from local database...')
          callback(domains)
        } else {
          console.warn('Fetching domains for PAC from registry API...')
          this.syncDatabaseWithRegistry(callback)
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  syncDatabaseWithRegistry = (callback) => {
    fetch(domainsApiUrl)
      .then((response) => response.json())
      .then((domains) => {
        const db = window.censortracker.Database

        db.set('domains', domains)

        console.warn('Local storage synchronized with registry!')
        if (callback !== undefined) {
          callback(domains)
        }
      })
      .catch((error) => {
        console.error(`Error on fetching data from API: ${error}`)
      })
  }

  excludeSpecialDomains = (domains = []) => {
    // ----------------- Testing -----------------
    domains = domains.filter((item) => item !== 'rutracker.org')
    domains = domains.filter((item) => item !== 'telegram.org')
    domains = domains.filter((item) => item !== 'lostfilm.tv')
    domains = domains.filter((item) => item !== 'tunnelbear.com')
    // --------------------------------------------

    const specialDomains = ['youtube.com']

    return domains.filter((domain) => {
      return !specialDomains.includes(domain)
    })
  }

  setProxyAutoConfig = (domains) => {
    const config = {
      value: {
        mode: 'pac_script',
        pacScript: {
          data: this.generatePacScriptData(domains),
          mandatory: false,
        },
      },
      scope: 'regular',
    }

    chrome.proxy.settings.set(config, () => {
      console.warn('PAC has been set successfully!')
    })
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   * @param domains An array of domains.
   * @returns {string} The PAC data.
   */
  generatePacScriptData = (domains = []) => {
    // The binary search works only with pre-sorted array.
    domains.sort()

    const http = 'proxy-nossl.roskomsvoboda.org:33333'
    const https = 'proxy-ssl.roskomsvoboda.org:33333'

    return `
function FindProxyForURL(url, host) {
  function isHostBlocked(array, target) {
    let left = 0;
    let right = array.length - 1;

    while (left <= right) {
      const mid = left + Math.floor((right - left) / 2);

      if (array[mid] === target) {
        return true;
      }

      if (array[mid] < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return false;
  }

  // Remove ending dot
  if (host.endsWith('.')) {
    host = host.substring(0, host.length - 1);
  }

  // Make domain second-level.
  let lastDot = host.lastIndexOf('.');
  if (lastDot !== -1) {
    lastDot = host.lastIndexOf('.', lastDot - 1);
    if (lastDot !== -1) {
      host = host.substr(lastDot + 1);
    }
  }

  // Domains, which are blocked.
  let domains = ${JSON.stringify(domains)};

  // Return result
  if (isHostBlocked(domains, host)) {
    return 'HTTPS ${https}; PROXY ${http};';
  } else {
    return 'DIRECT';
  }
}`
  }

  removeProxy = () => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      console.warn('Proxy auto-config disabled!')
    })
  }

  openPorts = () => {
    const proxyServerUrl = 'https://163.172.211.183:39263'
    const request = new XMLHttpRequest()

    request.open('GET', proxyServerUrl, true)
    request.addEventListener('error', (e) => {
      console.error(`Error on opening ports: ${e.target.status}`)
    })
    request.send(null)
  }

  removeOutdatedBlockedDomains = () => {
    const monthInSeconds = 2628000

    chrome.storage.local.get({ blockedDomains: [] }, (items) => {
      let blockedDomains = items.blockedDomains

      if (blockedDomains) {
        blockedDomains = blockedDomains.filter((item) => {
          const timestamp = new Date().getTime()

          return (timestamp - item.timestamp) / 1000 < monthInSeconds
        })
      }

      chrome.storage.local.set({ blockedDomains }, () => {
        console.warn('Outdated domains has been removed.')
        this.setProxyAutoConfig(blockedDomains)
      })
    })
  }
}

export default new Proxies()
