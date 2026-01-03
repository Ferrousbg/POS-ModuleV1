<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Customer\Model\ResourceModel\Customer\CollectionFactory;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Store\Model\StoreManagerInterface; // <--- НОВО: За работа с магазини

class Search extends Action
{
    protected $collectionFactory;
    protected $resultJsonFactory;
    protected $storeManager; // <--- НОВО

    public function __construct(
        Context $context,
        CollectionFactory $collectionFactory,
        JsonFactory $resultJsonFactory,
        StoreManagerInterface $storeManager // <--- НОВО
    ) {
        parent::__construct($context);
        $this->collectionFactory = $collectionFactory;
        $this->resultJsonFactory = $resultJsonFactory;
        $this->storeManager = $storeManager; // <--- НОВО
    }

    public function execute()
    {
        $query   = $this->getRequest()->getParam('q');
        $storeId = $this->getRequest()->getParam('store_id'); // Взимаме Store ID от JS

        $result = $this->resultJsonFactory->create();

        if (strlen($query) < 2) {
            return $result->setData([]);
        }

        $collection = $this->collectionFactory->create();
        $collection->addAttributeToSelect(['firstname', 'lastname', 'email', 'taxvat', 'website_id']); // Добавихме website_id

        // --- ИЗОЛАЦИЯ ПО МАГАЗИН (WEBSITE) ---
        // Ако имаме подаден Store ID, намираме неговия Website и филтрираме
        if ($storeId) {
            try {
                $websiteId = $this->storeManager->getStore($storeId)->getWebsiteId();
                // Това е "AND" условие. Търсим клиенти, които са САМО в този Website.
                $collection->addAttributeToFilter('website_id', $websiteId);
            } catch (\Exception $e) {
                // Ако store_id е невалиден, не гърмим, а просто продължаваме (или логваме)
            }
        }
        // ---------------------------------------

        // --- JOIN-ваме данните от Адреса по подразбиране (Billing) ---

        // Телефон и Град
        $collection->joinAttribute('billing_telephone', 'customer_address/telephone', 'default_billing', null, 'left');
        $collection->joinAttribute('billing_city', 'customer_address/city', 'default_billing', null, 'left');

        // Данни за Фактура (Фирма, ЕИК/ДДС)
        $collection->joinAttribute('billing_company', 'customer_address/company', 'default_billing', null, 'left');
        $collection->joinAttribute('billing_vat_id', 'customer_address/vat_id', 'default_billing', null, 'left');

        // Имената от адреса (за да ги ползваме за МОЛ)
        $collection->joinAttribute('billing_firstname', 'customer_address/firstname', 'default_billing', null, 'left');
        $collection->joinAttribute('billing_lastname', 'customer_address/lastname', 'default_billing', null, 'left');

        // --- ТЪРСЕНЕ (Име, Email, Тел, Фирма, Булстат + ID) ---
        // Това е блок с "OR" логика (едно от тези полета трябва да съвпада)
        // Забележка: Филтърът за Website по-горе е отделен и действа като "AND" към този блок.

        $filters = [
            ['attribute' => 'firstname', 'like' => '%' . $query . '%'],
            ['attribute' => 'lastname', 'like' => '%' . $query . '%'],
            ['attribute' => 'email', 'like' => '%' . $query . '%'],
            ['attribute' => 'billing_telephone', 'like' => '%' . $query . '%'],
            ['attribute' => 'billing_company', 'like' => '%' . $query . '%'],
            ['attribute' => 'billing_vat_id', 'like' => '%' . $query . '%']
        ];

        // Добавяме търсене по ID само ако е число
        if (is_numeric($query)) {
            $filters[] = ['attribute' => 'entity_id', 'eq' => $query];
        }

        $collection->addAttributeToFilter($filters);

        $collection->setPageSize(15);

        $items = [];
        foreach ($collection as $item) {

            // Логика за МОЛ
            $molName = trim($item->getData('billing_firstname') . ' ' . $item->getData('billing_lastname'));
            if (empty($molName)) {
                $molName = $item->getFirstname() . ' ' . $item->getLastname();
            }

            $items[] = [
                'id'        => $item->getId(),
                'firstname' => $item->getFirstname(),
                'lastname'  => $item->getLastname(),
                'email'     => $item->getEmail(),
                'telephone' => $item->getData('billing_telephone'),
                'company'   => $item->getData('billing_company') ?: '',
                'vat_id'    => $item->getData('billing_vat_id') ?: '',
                'city'      => $item->getData('billing_city') ?: '',
                'mol'       => $molName
            ];
        }

        return $result->setData($items);
    }
}