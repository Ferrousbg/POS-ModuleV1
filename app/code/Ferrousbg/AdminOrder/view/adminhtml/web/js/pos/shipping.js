define([
    'jquery',
    'Ferrousbg_AdminOrder/js/pos/econt/office',
    'Ferrousbg_AdminOrder/js/pos/econt/address'
], function ($, EcontOffice, EcontAddress) {
    'use strict';

    return function () {
        const officeLogic = EcontOffice();
        const addressLogic = EcontAddress();

        return {
            ...officeLogic,
            ...addressLogic,

            // --- STATE ---
            selectedShippingMethod: '',
            availableShippingMethods: [],
            // ВАЖНО: Тук няма фирмени данни, само логистика
            address: { street: '', street_number: '', note: '', city: '', postcode: '', telephone: '', cityId: null },
            savedAddresses: [],
            saveAsDefault: false,
            isShippingEdit: false,
            openDropdown: false,
            officeModal: { open: false, loading: false, mode: 'office', step: 'city', searchQuery: '', items: [], selectedCity: '', selectedCityId: null, rawOffices: [], currentCityOffices: [] },

            // --- INIT ---
            initShippingModule() {
                console.log("🚢 Shipping Module Initialized (Strict Mode)");
                this.updateShippingMethods();
                let defMethod = localStorage.getItem('pos_default_shipping_method');
                if(defMethod) this.selectedShippingMethod = defMethod;
            },

            updateShippingMethods() {
                if (this.urls.allShippingMethods && this.urls.allShippingMethods[this.currentStoreId]) {
                    this.availableShippingMethods = this.urls.allShippingMethods[this.currentStoreId];
                } else {
                    this.availableShippingMethods = [];
                }
            },

            selectMethodManual(code) {
                this.selectedShippingMethod = code;
                this.openDropdown = false;

                // --- FIX: FORCE PANEL TO STAY OPEN ---
                // Когато потребителят избере метод ръчно, искаме панелът да ОСТАНЕ ОТВОРЕН,
                // за да може да избере Офис или да напише Адрес.
                this.isShippingEdit = true;

                // Логика за чистене на адреса при смяна на типа
                if (code === 'econtaddress_econtaddress' || (code && !code.includes('econt'))) {
                    // Ако сменим от Офис на Адрес, чистим стария офис от полетата
                    if (this.address.street && (this.address.street.includes('[OFFICE]') || this.address.street.includes('Офис Еконт'))) {
                        this.address.street = '';
                        this.address.city = '';
                        this.address.postcode = '';
                    }
                }
            },

            // --- UI ACTIONS ---
            openEcontManual() {
                this.saveAsDefault = false;
                this.officeModal.mode = 'office';
                this.resetModal('city');
                this.fetchData('offices');
            },

            onSearchInput() {
                if (this.officeModal.mode === 'office') this.filterOfficesLocally();
                else this.onAddressSearchInput();
            },

            selectItem(item) {
                if (this.officeModal.mode === 'office') this.selectOfficeItem(item);
                else this.selectAddressItem(item);
            },

            // --- DATA FETCH ---
            fetchData(type) {
                this.officeModal.loading = true;
                let url = type === 'offices' ? this.urls.econtOfficesUrl : (type === 'cities' ? this.urls.econtCitiesUrl : this.urls.econtStreetsUrl);
                let data = type === 'cities' ? { query: this.officeModal.searchQuery } : (type === 'streets' ? { city_id: this.address.cityId || this.officeModal.selectedCityId, query: this.officeModal.searchQuery } : {});

                $.ajax({
                    url: url, type: 'GET', data: data, dataType: 'json', showLoader: false,
                    success: (response) => {
                        if (type === 'offices') this.processOfficesResponse(response);
                        else if (type === 'cities' && this.processCitiesResponse) this.processCitiesResponse(response);
                        else if (type === 'streets') this.processStreetsResponse(response);
                        this.officeModal.loading = false;
                    },
                    error: () => {
                        this.officeModal.loading = false;
                        this.notify('Грешка при комуникация със сървъра.', 'error');
                    }
                });
            },

            // --- LOAD CUSTOMER ADDRESSES ---
            loadCustomerAddresses(customerId) {
                if (!customerId) { this.savedAddresses = []; return; }
                this.isShippingEdit = false;

                $.ajax({
                    url: this.urls.customerGetAddressesUrl,
                    type: 'GET',
                    data: { customer_id: customerId },
                    dataType: 'json',
                    showLoader: false,
                    success: (res) => {
                        let raw = res.addresses || [];
                        let foundDefault = null;

                        let filteredList = raw.map(addr => {
                            let isDefShipping = (addr.default_shipping == 1 || addr.default_shipping === true);
                            let isDefBilling = (addr.default_billing == 1 || addr.default_billing === true);

                            if (isDefBilling && !isDefShipping) return null;

                            // 1. Извличане на данни
                            let fullString = Array.isArray(addr.street) ? addr.street.join(' ') : (addr.street || '');
                            let cleanStreet = fullString;
                            let note = '';

                            // 2. Парсване на бележка
                            if (fullString.match(/\[NOTE\]:/i)) {
                                let parts = fullString.split(/\[NOTE\]:\s*/i);
                                cleanStreet = parts[0].trim();
                                if (parts.length > 1) note = parts[1].trim();
                            }
                            else if (fullString.includes('Бележка:')) {
                                let parts = fullString.split('Бележка:');
                                cleanStreet = parts[0].trim();
                                note = parts[1].trim();
                            }

                            // 3. Определяне на тип
                            let isOff = cleanStreet.includes('[OFFICE]') || cleanStreet.includes('Офис Еконт');
                            cleanStreet = cleanStreet.replace('[OFFICE] ', '').replace('[OFFICE]', '').trim();

                            // 4. Форматиране
                            let listDisplayString = cleanStreet;
                            if (note) listDisplayString += ' (' + note + ')';

                            let formatted = {
                                id: addr.id,
                                city: addr.city,
                                postcode: addr.postcode,
                                telephone: addr.telephone,
                                street: listDisplayString,
                                _clean_street: cleanStreet,
                                note: note,
                                is_office: isOff,
                                default_shipping: isDefShipping
                            };

                            if (isDefShipping) foundDefault = formatted;
                            return formatted;
                        }).filter(item => item !== null);

                        this.savedAddresses = filteredList;

                        if (foundDefault) {
                            this.applySavedAddress(foundDefault, false); // Тук false затваря панела при зареждане (желано)
                        } else {
                            this.isShippingEdit = true; // Ако няма default, отваряме за избор
                        }
                    }
                });
            },

            // --- APPLY ADDRESS ---
            applySavedAddress(addr, shouldClosePanel = true) {
                console.log("Applying address:", addr);

                this.address = {
                    id: addr.id,
                    city: addr.city,
                    postcode: addr.postcode,
                    telephone: addr.telephone,

                    street: addr._clean_street || addr.street.split(/\[NOTE\]:|Бележка:/)[0].replace('[OFFICE]', '').trim(),
                    street_number: '',
                    note: addr.note || '',
                    cityId: null
                };

                if (addr.is_office) {
                    this._selectMethodIfAvailable('econt_econt', false); // Не викаме ръчния селект, за да не отваря панела излишно
                } else {
                    this._selectMethodIfAvailable('econtaddress_econtaddress', false);
                }

                // Просто обновяваме променливата за избрания метод
                if (addr.is_office) this.selectedShippingMethod = 'econt_econt';
                else this.selectedShippingMethod = 'econtaddress_econtaddress';

                if (shouldClosePanel) this.isShippingEdit = false;
            },

            _selectMethodIfAvailable(code) {
                if (!this.availableShippingMethods || this.availableShippingMethods.length === 0) this.updateShippingMethods();
                let m = this.availableShippingMethods.find(x => x.code === code);

                // Ако методът съществува, просто го сетваме, без да викаме selectMethodManual
                // защото selectMethodManual вече насилствено отваря панела
                if (m || code.includes('econt')) {
                    this.selectedShippingMethod = code;
                }
            },

            // --- SAVE ACTIONS ---
            saveCurrentAddressToBook() {
                if (!this._validateCustomer()) return;
                let streetClean = this.address.street.replace('[OFFICE] ', '').replace('[OFFICE]', '').trim();
                this._saveAddressLogic(streetClean, this.saveAsDefault, false);
            },

            saveCurrentOfficeToBook() {
                if (!this._validateCustomer()) return;

                if (!this.address.street.includes('Офис') && !this.address.street.includes('OFFICE')) {
                    this.notify('Моля, изберете офис от списъка!', 'error');
                    return;
                }

                let streetToSend = this.address.street;
                if (!streetToSend.includes('[OFFICE]')) {
                    streetToSend = '[OFFICE] ' + streetToSend;
                }

                this._saveAddressLogic(streetToSend, this.saveAsDefault, true);
            },

            editSavedAddress(addr) {
                this.applySavedAddress(addr, false);
                this.saveAsDefault = (addr.default_shipping === true || addr.default_shipping === "true" || addr.default_shipping == 1);
                this.isShippingEdit = true;
            },

            deleteSavedAddress(addressId) {
                $.ajax({
                    url: this.urls.customerDeleteAddressUrl, type: 'POST', data: { address_id: addressId }, showLoader: true,
                    success: (res) => {
                        if (res.success) {
                            this.loadCustomerAddresses(this.customer.id);
                            this.notify('Адресът е изтрит успешно!', 'success');
                        } else {
                            this.notify(res.message || 'Грешка при триене.', 'error');
                        }
                    }
                });
            },

            _validateCustomer() {
                if (!this.customer || !this.customer.id) {
                    this.notify('Моля, първо изберете клиент!', 'error');
                    return false;
                }
                return true;
            },

            // === УМНА ЛОГИКА ЗА ЗАПИС / ОБНОВЯВАНЕ ===
            _saveAddressLogic(streetValue, isDefault, isOfficeSave) {
                let cleanInputStreet = streetValue.replace('[OFFICE] ', '').replace('[OFFICE]', '').trim();
                let inputCity = this.address.city.trim();
                let inputNote = (this.address.note || '').trim();
                let existingId = null;

                let foundDuplicate = this.savedAddresses.find(addr => {
                    if (addr.city.toLowerCase() !== inputCity.toLowerCase()) return false;
                    let savedClean = (addr._clean_street || addr.street).trim();
                    if (savedClean.toLowerCase() !== cleanInputStreet.toLowerCase()) return false;
                    let savedNote = (addr.note || '').trim();
                    if (savedNote !== inputNote) return false;
                    if (!!isOfficeSave !== !!addr.is_office) return false;
                    return true;
                });

                if (foundDuplicate) {
                    console.log("♻️ Found existing address ID:", foundDuplicate.id);
                    existingId = foundDuplicate.id;
                } else if (this.address.id) {
                    existingId = this.address.id;
                }

                let data = {
                    customer_id: this.customer.id,
                    address_id: existingId,
                    city: this.address.city,
                    postcode: this.address.postcode,
                    street: streetValue,
                    street_number: this.address.street_number,
                    note: this.address.note,
                    telephone: this.address.telephone || this.customer.telephone,
                    is_default: isDefault ? 1 : 0
                };

                $.ajax({
                    url: this.urls.customerSaveAddressUrl, type: 'POST', data: data, showLoader: true,
                    success: (res) => {
                        if (res.success) {
                            this.loadCustomerAddresses(this.customer.id);
                            if (existingId) this.notify('Адресът е обновен успешно!', 'success');
                            else this.notify('Адресът е създаден успешно!', 'success');
                        } else {
                            this.notify(res.message, 'error');
                        }
                    },
                    error: () => {
                        this.notify('Грешка при връзка със сървъра.', 'error');
                    }
                });
            },

            saveAddress() {
                let currentStreet = this.address.street;
                if (this.address.street_number && !currentStreet.includes(this.address.street_number)) {
                    this.address.street = currentStreet + ' ' + this.address.street_number;
                    this.address.street_number = '';
                }
                this.isShippingEdit = false;
            },

            resetModal(step) {
                this.saveAsDefault = false;
                this.officeModal.step = step; this.officeModal.open = true; this.officeModal.searchQuery = ''; this.officeModal.items = [];
            },
            closeOfficeModal() { this.officeModal.open = false; },
            backToCities() {
                this.officeModal.step = 'city'; this.officeModal.searchQuery = ''; this.officeModal.items = [];
                if (this.officeModal.mode === 'office') this.officeModal.open = false;
                else this.openAddressWizard();
            }
        };
    };
});