<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Request;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Customer\Api\AddressRepositoryInterface;
use Magento\Framework\Stdlib\DateTime\DateTime;

class Create extends Action
{
    protected $jsonFactory;
    protected $productRepository;
    protected $resourceConnection;
    protected $customerRepository;
    protected $addressRepository;
    protected $dateTime;

    public function __construct(
        Context $context,
        JsonFactory $jsonFactory,
        ProductRepositoryInterface $productRepository,
        ResourceConnection $resourceConnection,
        CustomerRepositoryInterface $customerRepository,
        AddressRepositoryInterface $addressRepository,
        DateTime $dateTime
    ) {
        parent::__construct($context);
        $this->jsonFactory = $jsonFactory;
        $this->productRepository = $productRepository;
        $this->resourceConnection = $resourceConnection;
        $this->customerRepository = $customerRepository;
        $this->addressRepository = $addressRepository;
        $this->dateTime = $dateTime;
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();

        // Get JSON payload from request body
        $postContent = $this->getRequest()->getContent();
        $data = json_decode($postContent, true);

        if (!$data) {
            return $result->setData(['success' => false, 'message' => 'Invalid data']);
        }

        try {
            // Validate required fields
            if (empty($data['store_id'])) {
                return $result->setData(['success' => false, 'message' => 'Store ID is required']);
            }
            
            if (empty($data['customer']) || empty($data['customer']['id'])) {
                return $result->setData(['success' => false, 'message' => 'Customer ID is required']);
            }
            
            if (empty($data['items']) || !is_array($data['items'])) {
                return $result->setData(['success' => false, 'message' => 'Items are required']);
            }

            $customerId = (int)$data['customer']['id'];
            $storeId = (int)$data['store_id'];
            $paymentMethod = $data['payment_method'] ?? '';
            $shippingMethod = $data['shipping_method'] ?? '';
            $shippingAddressId = !empty($data['shipping_address_id']) ? (int)$data['shipping_address_id'] : null;
            $billingAddressId = null;

            // Resolve billing address
            if (!empty($data['billing_address_id'])) {
                // Explicit billing address provided
                $billingAddressId = (int)$data['billing_address_id'];
            } else {
                // Use customer's default billing address
                $customer = $this->customerRepository->getById($customerId);
                $defaultBillingId = $customer->getDefaultBilling();
                
                if (!$defaultBillingId) {
                    return $result->setData([
                        'success' => false, 
                        'message' => 'No billing address found. Please select a billing address.'
                    ]);
                }
                
                $billingAddressId = (int)$defaultBillingId;
            }

            $connection = $this->resourceConnection->getConnection();
            
            // Insert into mgwf_ferrous_request table
            $currentTime = $this->dateTime->gmtDate();
            $requestData = [
                'customer_id' => $customerId,
                'store_id' => $storeId,
                'status' => 'open',
                'payment_method' => $paymentMethod,
                'shipping_method' => $shippingMethod,
                'billing_customer_address_id' => $billingAddressId,
                'shipping_customer_address_id' => $shippingAddressId,
                'created_at' => $currentTime,
                'updated_at' => $currentTime
            ];
            
            $connection->insert(
                $this->resourceConnection->getTableName('mgwf_ferrous_request'),
                $requestData
            );
            
            $requestId = $connection->lastInsertId();

            // Load all products at once to avoid N+1 queries
            $productIds = array_column($data['items'], 'id');
            $products = [];
            foreach ($productIds as $productId) {
                try {
                    $products[$productId] = $this->productRepository->getById($productId);
                } catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
                    return $result->setData([
                        'success' => false, 
                        'message' => 'Product with ID ' . $productId . ' not found.'
                    ]);
                }
            }

            // Insert items into mgwf_ferrous_request_item table
            foreach ($data['items'] as $item) {
                $productId = (int)$item['id'];
                $qty = (int)$item['qty'];
                
                $product = $products[$productId];
                
                $itemData = [
                    'request_id' => $requestId,
                    'product_id' => $productId,
                    'sku' => $product->getSku(),
                    'name' => $product->getName(),
                    'qty' => $qty,
                    'custom_price' => $product->getPrice(),
                    'reserved_qty' => 0,
                    'is_pre_confirmed' => 0
                ];
                
                $connection->insert(
                    $this->resourceConnection->getTableName('mgwf_ferrous_request_item'),
                    $itemData
                );
            }

            return $result->setData([
                'success' => true,
                'request_id' => $requestId
            ]);

        } catch (\Exception $e) {
            return $result->setData([
                'success' => false, 
                'message' => $e->getMessage()
            ]);
        }
    }

    protected function _isAllowed()
    {
        return $this->_authorization->isAllowed('Magento_Sales::create');
    }
}
