<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Customer\Api\CustomerRepositoryInterface;

class GetAddresses extends Action
{
    protected $resultJsonFactory;
    protected $customerRepository;

    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        CustomerRepositoryInterface $customerRepository
    ) {
        parent::__construct($context);
        $this->resultJsonFactory = $resultJsonFactory;
        $this->customerRepository = $customerRepository;
    }

    public function execute()
    {
        $result = $this->resultJsonFactory->create();
        $customerId = $this->getRequest()->getParam('customer_id');

        if (!$customerId) {
            return $result->setData(['addresses' => []]);
        }

        try {
            $customer = $this->customerRepository->getById($customerId);

            // Взимаме ID-тата на основните адреси от клиента
            $defaultShippingId = $customer->getDefaultShipping();
            $defaultBillingId  = $customer->getDefaultBilling();

            $addresses = [];

            if ($customer->getAddresses()) {
                foreach ($customer->getAddresses() as $address) {
                    // Събираме редовете на улицата
                    $streetLines = $address->getStreet();
                    $fullStreet = is_array($streetLines) ? implode(' ', $streetLines) : $streetLines;

                    $addresses[] = [
                        'id'        => $address->getId(),
                        'city'      => $address->getCity(),
                        'postcode'  => $address->getPostcode(),
                        'street'    => $fullStreet,
                        'telephone' => $address->getTelephone(),
                        // ДОБАВЯМЕ ФЛАГОВЕТЕ ТУК:
                        'default_shipping' => ($address->getId() == $defaultShippingId),
                        'default_billing'  => ($address->getId() == $defaultBillingId)
                    ];
                }
            }

            // Сортиране: Основният адрес да е най-отгоре
            usort($addresses, function ($a, $b) {
                if ($a['default_shipping']) return -1;
                if ($b['default_shipping']) return 1;
                return 0;
            });

            return $result->setData(['addresses' => $addresses]);

        } catch (\Exception $e) {
            return $result->setData(['addresses' => [], 'error' => $e->getMessage()]);
        }
    }
}