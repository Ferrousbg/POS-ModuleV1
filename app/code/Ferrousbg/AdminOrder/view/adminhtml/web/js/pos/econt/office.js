define(['jquery'], function ($) {
    'use strict';

    return function () {
        return {
            openEcontManual() {
                this.officeModal.mode = 'office';
                this.resetModal('city');
                this.fetchData('offices');
            },

            // --- ЛОГИКА ЗА ФИЛТРИРАНЕ (С ДЕБЪГ ЛОГОВЕ) ---
            filterOfficesLocally() {
                let query = (this.officeModal.searchQuery || '').toLowerCase().trim();
                console.log("🚀 [OFFICE.JS] filterOfficesLocally called. Query:", query, "Step:", this.officeModal.step);

                // Карта за превод: Кирилица -> Латиница
                const bgToEn = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh',
                    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
                    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
                    'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y',
                    'ю': 'yu', 'я': 'ya'
                };

                const transliterate = (text) => {
                    return text.toLowerCase().split('').map(char => bgToEn[char] || char).join('');
                };

                const isMatch = (targetText) => {
                    if (!targetText) return false;
                    let original = targetText.toLowerCase();
                    let latinized = transliterate(original);

                    // За дебъг само на първите няколко опита
                    if (targetText === 'Пазарджик' || targetText === 'София') {
                        console.log(`   📝 Check: "${targetText}" -> Lat: "${latinized}" vs Query: "${query}" => Match: ${original.includes(query) || latinized.includes(query)}`);
                    }

                    return original.includes(query) || latinized.includes(query);
                };

                // --- 1. ФИЛТРИРАНЕ НА ГРАДОВЕ ---
                if (this.officeModal.step === 'city') {
                    // ПРОВЕРКА 1: Има ли сурови данни?
                    if (!this.officeModal.rawOffices || this.officeModal.rawOffices.length === 0) {
                        console.error("❌ [OFFICE.JS] rawOffices is empty! Cannot filter cities.");
                        return;
                    }

                    console.log(`✅ [OFFICE.JS] rawOffices count: ${this.officeModal.rawOffices.length}`);

                    const cityMap = {};
                    this.officeModal.rawOffices.forEach(o => {
                        if (!cityMap[o.city]) cityMap[o.city] = o.postCode || '';
                    });

                    const allCities = Object.keys(cityMap).sort();
                    console.log(`✅ [OFFICE.JS] Unique cities found: ${allCities.length}`);

                    // ФИЛТРИРАМЕ
                    const filteredCities = allCities.filter(cityName => {
                        if (!query) return true;
                        return isMatch(cityName);
                    });

                    console.log(`🎯 [OFFICE.JS] Filtered result count: ${filteredCities.length}`);

                    this.officeModal.items = filteredCities.map(c => ({
                        name: c,
                        postCode: cityMap[c],
                        type: 'city_group'
                    }));
                }

                // --- 2. ФИЛТРИРАНЕ НА ОФИСИ ---
                else if (this.officeModal.step === 'office') {
                    if (!this.officeModal.currentCityOffices) return;

                    console.log(`✅ [OFFICE.JS] Filtering offices in city... Count: ${this.officeModal.currentCityOffices.length}`);

                    this.officeModal.items = this.officeModal.currentCityOffices.filter(o => {
                        if (!query) return true;
                        return isMatch(o.name) || isMatch(o.code) || isMatch(o.address);
                    });
                }
            },

            // Обработка на данните
            processOfficesResponse(response) {
                console.log("📥 [OFFICE.JS] Response received. Offices count:", response.offices ? response.offices.length : 0);
                if (response.offices) {
                    this.officeModal.rawOffices = response.offices;
                    this.filterOfficesLocally();
                }
            },

            selectOfficeItem(item) {
                if (this.officeModal.step === 'city') {
                    this.officeModal.selectedCity = item.name;
                    const sampleOffice = this.officeModal.rawOffices.find(o => o.city === item.name);
                    this.officeModal.selectedCityId = sampleOffice ? sampleOffice.city_id : null;

                    this.address.city = item.name;
                    this.address.postcode = item.postCode;
                    this.address.cityId = this.officeModal.selectedCityId;

                    this.officeModal.step = 'office';
                    this.officeModal.searchQuery = '';
                    this.officeModal.currentCityOffices = this.officeModal.rawOffices.filter(o => o.city === item.name);
                    this.officeModal.items = this.officeModal.currentCityOffices;

                    // Трябва да извикаме филтъра веднага за офисите
                    this.filterOfficesLocally();
                }
                else if (this.officeModal.step === 'office') {
                    let codeValue = item.code || item.office_code || item.id || '';
                    let codeSuffix = codeValue ? ' (' + codeValue + ')' : '';
                    this.address.street = 'Офис Еконт: ' + item.name + codeSuffix;
                    this.closeOfficeModal();
                }
            }
        };
    };
});