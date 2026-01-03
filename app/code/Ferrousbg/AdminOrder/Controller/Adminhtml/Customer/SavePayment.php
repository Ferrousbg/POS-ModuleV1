<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;

class SavePayment extends Action
{
    protected $resultJsonFactory;
    protected $resource;

    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        ResourceConnection $resource
    ) {
        parent::__construct($context);
        $this->resultJsonFactory = $resultJsonFactory;
        $this->resource = $resource;
    }

    public function execute()
    {
        $result = $this->resultJsonFactory->create();

        try {
            $customerId = $this->getRequest()->getParam('customer_id');
            $paymentMethod = $this->getRequest()->getParam('payment_method');

            if (!$customerId || !$paymentMethod) {
                throw new \Exception('Липсват данни (customer_id или payment_method).');
            }

            $connection = $this->resource->getConnection();
            $varcharTable = $this->resource->getTableName('customer_entity_varchar');
            $eavTable = $this->resource->getTableName('eav_attribute');

            // 1. Намираме ID на атрибута
            $attrId = $connection->fetchOne(
                $connection->select()
                    ->from($eavTable, 'attribute_id')
                    ->where('attribute_code = ?', 'default_payment')
                    ->where('entity_type_id = ?', 1) // 1 = Customer
            );

            if (!$attrId) {
                throw new \Exception('Атрибутът default_payment не е дефиниран в Magento.');
            }

            // 2. Проверка за store_id колона (за съвместимост)
            $columns = $connection->describeTable($varcharTable);
            $hasStoreId = isset($columns['store_id']);

            // 3. ИЗТРИВАНЕ на старата стойност
            $where = [
                'entity_id = ?' => $customerId,
                'attribute_id = ?' => $attrId
            ];
            $connection->delete($varcharTable, $where);

            // 4. ВКАРВАНЕ на новата стойност
            $data = [
                'attribute_id' => $attrId,
                'entity_id'    => $customerId,
                'value'        => $paymentMethod
            ];

            if ($hasStoreId) {
                $data['store_id'] = 0; // 0 = Admin / Default Scope
            }

            $connection->insert($varcharTable, $data);

            return $result->setData([
                'success' => true,
                'message' => 'Методът е запазен успешно.'
            ]);

        } catch (\Exception $e) {
            return $result->setData([
                'success' => false,
                'message' => 'Грешка при запис: ' . $e->getMessage()
            ]);
        }
    }
}