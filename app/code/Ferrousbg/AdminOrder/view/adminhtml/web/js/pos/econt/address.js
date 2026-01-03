define(['jquery'], function ($) {
    'use strict';

    return function () {
        return {
            // --- СТАРТ ---
            openAddressWizard() {
                this.officeModal.mode = 'address';
                this.resetModal('city');

                // Проверка: Имаме ли вече заредени градове в паметта?
                if (!this.allCitiesCache || this.allCitiesCache.length === 0) {
                    this.fetchAllCities(); // Ако не -> теглим (от кеш или сървър)
                } else {
                    // Ако ги имаме -> показваме веднага
                    this.filterCitiesLocallyAddress();
                }
            },

            openStreetSelector() {
                if (!this.address.cityId && !this.officeModal.selectedCityId) {
                    this.notify('Моля, първо изберете град чрез търсачката!', 'error');
                    return;
                }
                this.officeModal.mode = 'address';
                this.resetModal('street');
                // За улиците не зареждаме нищо предварително, чакаме търсене
            },

            // --- ТРАНСЛИТЕРАТОР (LAT -> CYR) ---
            latToCyrGlobal(text) {
                if (!text) return '';
                let t = text.toLowerCase();
                t = t.replace(/sht/g, 'щ').replace(/sh/g, 'ш').replace(/ch/g, 'ч')
                    .replace(/zh/g, 'ж').replace(/yu/g, 'ю').replace(/ya/g, 'я')
                    .replace(/ts/g, 'ц');

                const map = {
                    'a': 'а', 'b': 'б', 'c': 'ц', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г', 'h': 'х',
                    'i': 'и', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п',
                    'q': 'я', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в', 'w': 'в', 'x': 'х',
                    'y': 'ъ', 'z': 'з'
                };
                return t.split('').map(char => map[char] || char).join('');
            },

            // --- ЗАРЕЖДАНЕ НА ВСИЧКИ ГРАДОВЕ (С КЕШ 30 ДНИ) ---
            fetchAllCities() {
                const CACHE_KEY = 'econt_cities_v4'; // Версия на кеша
                const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 дни

                // 1. ПРОВЕРКА В BROWSER CACHE (LocalStorage)
                let cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        let data = JSON.parse(cached);
                        // Проверяваме дали не е остарял (timestamp)
                        if (data.timestamp && (Date.now() - data.timestamp < CACHE_DURATION)) {
                            console.log(`⚡ Loaded ${data.cities.length} cities from Browser Storage (Fast Cache).`);
                            this.allCitiesCache = data.cities;
                            this.filterCitiesLocallyAddress();
                            return; // СПИРАМЕ ТУК! Не правим заявка към сървъра.
                        } else {
                            console.log('⚠️ Browser cache expired. Refreshing...');
                            localStorage.removeItem(CACHE_KEY);
                        }
                    } catch (e) {
                        localStorage.removeItem(CACHE_KEY);
                    }
                }

                // 2. АКО НЯМА В БРАУЗЪРА -> ТЕГЛИМ ОТ СЪРВЪРА (PHP)
                this.officeModal.loading = true;
                $.ajax({
                    url: this.urls.econtCitiesUrl,
                    type: 'GET',
                    dataType: 'json',
                    showLoader: false,
                    success: (response) => {
                        this.allCitiesCache = response.cities || [];
                        console.log(`🌐 Loaded ${this.allCitiesCache.length} cities from Server.`);

                        // Записваме в LocalStorage за следващия път
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify({
                                timestamp: Date.now(),
                                cities: this.allCitiesCache
                            }));
                        } catch (e) {
                            console.warn('LocalStorage quota exceeded, cannot cache cities locally.');
                        }

                        this.filterCitiesLocallyAddress();
                        this.officeModal.loading = false;
                    },
                    error: () => {
                        console.error('Failed to load cities.');
                        this.officeModal.loading = false;
                    }
                });
            },

            // --- ЛОКАЛНО ТЪРСЕНЕ НА ГРАД (БЪРЗО) ---
            filterCitiesLocallyAddress() {
                let rawInput = (this.officeModal.searchQuery || '').toLowerCase().trim();
                let translatedInput = this.latToCyrGlobal(rawInput);

                // АКО НЯМА ТЪРСЕНЕ -> ПОКАЗВАМЕ ПОПУЛЯРНИТЕ
                if (!rawInput) {
                    const priorityCities = ['софия', 'пловдив', 'варна', 'бургас', 'русе', 'стара загора', 'плевен', 'пазарджик', 'благоевград', 'велико търново'];

                    let topCities = this.allCitiesCache.filter(c => priorityCities.includes((c.name || '').toLowerCase()));
                    let others = this.allCitiesCache.slice(0, 30); // Показваме малко повече

                    // Обединяваме и махаме дубликатите
                    let combined = [...topCities, ...others];
                    this.officeModal.items = [...new Map(combined.map(item => [item['id'], item])).values()];
                    return;
                }

                // ТЪРСЕНЕ
                const filtered = this.allCitiesCache.filter(city => {
                    let cityName = (city.name || '').toLowerCase();
                    return cityName.includes(rawInput) || cityName.includes(translatedInput);
                });

                // СОРТИРАНЕ
                filtered.sort((a, b) => {
                    let aName = (a.name || '').toLowerCase();
                    let bName = (b.name || '').toLowerCase();

                    let aStarts = aName.startsWith(rawInput) || aName.startsWith(translatedInput);
                    let bStarts = bName.startsWith(rawInput) || bName.startsWith(translatedInput);

                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;

                    return a.name.length - b.name.length;
                });

                // Ограничаваме до 50 за бързина
                this.officeModal.items = filtered.slice(0, 50);
            },

            // --- СЪРВЪРНО ТЪРСЕНЕ НА УЛИЦИ (Само за улици) ---
            searchStreetsOnServer() {
                let query = (this.officeModal.searchQuery || '').trim();

                // Минимално 2 символа за улици
                if (query.length < 2) return;

                if (/[a-zA-Z]/.test(query)) {
                    query = this.latToCyrGlobal(query);
                }

                if (this.searchTimeout) clearTimeout(this.searchTimeout);

                this.officeModal.loading = true;
                this.searchTimeout = setTimeout(() => {
                    $.ajax({
                        url: this.urls.econtStreetsUrl,
                        type: 'GET',
                        data: {
                            city_id: this.address.cityId || this.officeModal.selectedCityId,
                            query: query
                        },
                        dataType: 'json',
                        success: (res) => {
                            this.officeModal.items = res.streets || [];
                            this.officeModal.loading = false;
                        },
                        error: () => { this.officeModal.loading = false; }
                    });
                }, 400); // 400ms debounce
            },

            // --- ГЛАВЕН DISPATCHER (Вика се от onSearchInput в shipping.js) ---
            onAddressSearchInput() {
                if (this.officeModal.step === 'city') {
                    this.filterCitiesLocallyAddress();
                } else {
                    this.searchStreetsOnServer();
                }
            },

            selectAddressItem(item) {
                // 1. Избран е ГРАД
                if (this.officeModal.step === 'city') {
                    this.officeModal.selectedCity = item.name;
                    this.officeModal.selectedCityId = item.id;

                    let prefix = item.type ? item.type + ' ' : '';
                    this.address.city = prefix + item.name;
                    this.address.postcode = item.postCode;
                    this.address.cityId = item.id;

                    // Минаваме на стъпка УЛИЦА
                    this.officeModal.step = 'street';
                    this.officeModal.searchQuery = '';
                    this.officeModal.items = [];
                    // Тук не зареждаме нищо, чакаме юзъра да пише
                }
                // 2. Избрана е УЛИЦА
                else if (this.officeModal.step === 'street') {
                    let streetName = item.name
                        .replace(/^ул\.\s*/i, '')
                        .replace(/^ul\.\s*/i, '')
                        .replace(/^кв\.\s*/i, 'кв. ');

                    if (streetName.startsWith('кв. ') || streetName.startsWith('жк. ')) {
                        this.address.street = streetName;
                    } else {
                        this.address.street = streetName;
                    }

                    this.address.street_number = '';
                    this.closeOfficeModal();
                }
            }
        };
    };
});