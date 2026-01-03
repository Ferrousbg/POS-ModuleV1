<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Customer\Api\AddressRepositoryInterface;
use Magento\Customer\Api\Data\AddressInterfaceFactory;
use Magento\Customer\Api\CustomerRepositoryInterface;

class SaveAddress extends Action
{
    /**
     * @var JsonFactory
     */
    protected $resultJsonFactory;

    /**
     * @var AddressRepositoryInterface
     */
    protected $addressRepository;

    /**
     * @var AddressInterfaceFactory
     */
    protected $addressFactory;

    /**
     * @var CustomerRepositoryInterface
     */
    protected $customerRepository;

    /**
     * @param Context $context
     * @param JsonFactory $resultJsonFactory
     * @param AddressRepositoryInterface $addressRepository
     * @param AddressInterfaceFactory $addressFactory
     * @param CustomerRepositoryInterface $customerRepository
     */
    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        AddressRepositoryInterface $addressRepository,
        AddressInterfaceFactory $addressFactory,
        CustomerRepositoryInterface $customerRepository
    ) {
        parent::__construct($context);
        $this->resultJsonFactory = $resultJsonFactory;
        $this->addressRepository = $addressRepository;
        $this->addressFactory = $addressFactory;
        $this->customerRepository = $customerRepository;
    }

    /**
     * Save or Update Customer Shipping Address
     *
     * @return \Magento\Framework\Controller\Result\Json
     */
    public function execute()
    {
        $result = $this->resultJsonFactory->create();

        try {
            $data = $this->getRequest()->getParams();
            $customerId = $data['customer_id'] ?? null;

            if (!$customerId) {
                throw new \Exception(__('Customer ID is required.'));
            }

            // Зареждаме клиента, за да вземем имената му
            $customer = $this->customerRepository->getById($customerId);

            // 1. Подготовка на данните от POS-а
            $newCity = trim($data['city'] ?? '');

            // Забележка: Ако е офис, 'street' ще дойде като "[OFFICE] Офис Еконт..."
            $newStreet = trim($data['street'] ?? '');

            // Ако има отделен номер/блок (за личен адрес), го залепяме към улицата
            if (!empty($data['street_number']) && mb_strpos($newStreet, $data['street_number']) === false) {
                $newStreet .= ' ' . trim($data['street_number']);
            }

            // 2. Търсене на дубликати (за да не трупаме еднакви адреси)
            $existingAddresses = $customer->getAddresses();
            $targetAddress = null;
            $isUpdate = false;

            if ($existingAddresses !== null) {
                foreach ($existingAddresses as $addr) {
                    $existingStreet = $addr->getStreet();
                    $existingLine1 = isset($existingStreet[0]) ? $existingStreet[0] : '';

                    // Сравняваме град и улица (case-insensitive)
                    $dbCity = mb_strtolower(trim($addr->getCity()), 'UTF-8');
                    $inputCity = mb_strtolower($newCity, 'UTF-8');

                    $dbStreet = mb_strtolower(trim($existingLine1), 'UTF-8');
                    $inputStreet = mb_strtolower($newStreet, 'UTF-8');

                    if ($dbCity === $inputCity && $dbStreet === $inputStreet) {
                        $targetAddress = $addr;
                        $isUpdate = true;
                        break;
                    }
                }
            }

            // 3. Ако не е намерен съществуващ -> Създаваме нов
            if (!$targetAddress) {
                $targetAddress = $this->addressFactory->create();
                $targetAddress->setCustomerId($customerId);
                // Ползваме имената на акаунта за Shipping получател
                $targetAddress->setFirstname($customer->getFirstname());
                $targetAddress->setLastname($customer->getLastname());
            }

            // 4. Попълване на данните
            $finalStreetString = $newStreet;

            // Ако има бележка, я лепим на същия ред с маркера
            if (!empty($data['note'])) {
                $finalStreetString .= ' [NOTE]:' . trim($data['note']);
            }

            // Подаваме масив с 1 елемент, за да не гърми валидацията
            $targetAddress->setStreet([$finalStreetString]);

            $targetAddress->setCountryId('BG');
            $targetAddress->setCity($newCity);

            // Пощенски код (задължителен в Magento)
            $postcode = !empty($data['postcode']) ? $data['postcode'] : '1000';
            $targetAddress->setPostcode($postcode);

            $targetAddress->setTelephone($data['telephone'] ?? '-');

            // 5. ЛОГИКА ЗА DEFAULT (ОСНОВЕН)
            // Взимаме 'is_default' от JS заявката (това е чекбокса "Запази като основен")
            $isDefault = isset($data['is_default']) && $data['is_default'] == '1';

            if ($isDefault) {
                // ВАЖНО: Задаваме го САМО като Default Shipping
                $targetAddress->setIsDefaultShipping(true);

                // ИЗРИЧНО НЕ пипаме Default Billing, за да не счупим фактурата
                $targetAddress->setIsDefaultBilling(false);
            }

            // 6. Запис в базата
            $this->addressRepository->save($targetAddress);

            return $result->setData([
                'success' => true,
                'message' => $isUpdate ? __('Адресът беше обновен.') : __('Адресът беше добавен успешно!')
            ]);

        } catch (\Exception $e) {
            return $result->setData([
                'success' => false,
                'message' => 'Грешка: ' . $e->getMessage()
            ]);
        }
    }
}