<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;

class GetPayment extends Action
{
    protected $jsonFactory;
    protected $resource;

    public function __construct(
        Context $context,
        JsonFactory $jsonFactory,
        ResourceConnection $resource
    ) {
        parent::__construct($context);
        $this->jsonFactory = $jsonFactory;
        $this->resource = $resource;
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();
        $customerId = $this->getRequest()->getParam('customer_id');

        if (!$customerId) {
            return $result->setData(['success' => false, 'message' => 'No ID provided']);
        }

        try {
            $connection = $this->resource->getConnection();
            $varcharTable = $this->resource->getTableName('customer_entity_varchar');
            $eavTable = $this->resource->getTableName('eav_attribute');

            // 1. Намираме ID на атрибута
            $attrId = $connection->fetchOne(
                $connection->select()
                    ->from($eavTable, 'attribute_id')
                    ->where('attribute_code = ?', 'default_payment')
                    ->where('entity_type_id = ?', 1)
            );

            $paymentMethod = null;

            if ($attrId) {
                // 2. Взимаме стойността
                $select = $connection->select()
                    ->from($varcharTable, 'value')
                    ->where('entity_id = ?', $customerId)
                    ->where('attribute_id = ?', $attrId);

                // Ако таблицата има store_id, сортираме, за да вземем най-релевантния
                // (Въпреки че записваме с 0, това е добра практика)
                $columns = $connection->describeTable($varcharTable);
                if (isset($columns['store_id'])) {
                    $select->order('store_id DESC');
                }

                $select->limit(1);

                $paymentMethod = $connection->fetchOne($select);
            }

            return $result->setData([
                'success' => true,
                'default_payment' => $paymentMethod // Ще върне string (напр. "banktransfer") или false/null
            ]);

        } catch (\Exception $e) {
            return $result->setData([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
}