<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;

class HistoryOrders extends Action
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
        $customerId = $this->getRequest()->getParam('customer_id');

        if (!$customerId) {
            return $result->setData(['success' => false, 'message' => 'Липсва Customer ID']);
        }

        try {
            $connection = $this->resource->getConnection();

            // ---------------------------------------------------------
            // СТЪПКА 1: Намираме Имейла на клиента
            // ---------------------------------------------------------
            // Това е критично, защото често старите поръчки нямат ID, а само Email.
            $customerTable = $this->resource->getTableName('customer_entity');
            $customerEmail = $connection->fetchOne(
                $connection->select()
                    ->from($customerTable, 'email')
                    ->where('entity_id = ?', $customerId)
            );

            // ---------------------------------------------------------
            // СТЪПКА 2: Търсим ПОРЪЧКИ (в sales_order)
            // ---------------------------------------------------------
            $salesOrderTable = $this->resource->getTableName('sales_order');

            // Правим заявка само към главната таблица
            $ordersSelect = $connection->select()
                ->from($salesOrderTable, [
                    'entity_id',
                    'increment_id',
                    'grand_total',
                    'order_currency_code',
                    'status',
                    'created_at'
                ])
                ->order('created_at DESC')
                ->limit(50);

            // УСЛОВИЕ: Търсим по ID на клиента ИЛИ по неговия Email
            if ($customerEmail) {
                $ordersSelect->where('customer_id = ? OR customer_email = ?', $customerId, $customerEmail);
            } else {
                $ordersSelect->where('customer_id = ?', $customerId);
            }

            $rawOrders = $connection->fetchAll($ordersSelect);
            $formattedOrders = [];

            foreach ($rawOrders as $order) {
                $formattedOrders[] = [
                    'id'       => $order['increment_id'],
                    'date'     => date('d.m.Y H:i', strtotime($order['created_at'])),
                    'total'    => number_format((float)$order['grand_total'], 2) . ' ' . $order['order_currency_code'],
                    'status'   => ucfirst($order['status']),
                    'view_url' => $this->getUrl('sales/order/view', ['order_id' => $order['entity_id']])
                ];
            }

            // ---------------------------------------------------------
            // СТЪПКА 3: Търсим ЗАЯВКИ (Requests)
            // ---------------------------------------------------------
            $reqTable  = $this->resource->getTableName('mgwf_ferrous_request');
            $itemTable = $this->resource->getTableName('mgwf_ferrous_request_item');

            $requestsSelect = $connection->select()
                ->from(['r' => $reqTable], ['request_id', 'status', 'created_at'])
                ->joinLeft(
                    ['i' => $itemTable],
                    'r.request_id = i.request_id',
                    [
                        // Събираме продуктите в един стринг
                        'items_summary' => new \Zend_Db_Expr("GROUP_CONCAT(CONCAT(i.name, ' (', CAST(i.qty AS DECIMAL(10,2)), ')') SEPARATOR ', ')")
                    ]
                )
                ->where('r.customer_id = ?', $customerId)
                ->group('r.request_id')
                ->order('r.created_at DESC')
                ->limit(20);

            $rawRequests = $connection->fetchAll($requestsSelect);
            $formattedRequests = [];

            foreach ($rawRequests as $req) {
                $formattedRequests[] = [
                    'id'     => $req['request_id'],
                    'date'   => date('d.m.Y', strtotime($req['created_at'])),
                    'status' => ucwords(str_replace('_', ' ', $req['status'])),
                    'items'  => $req['items_summary'] ?: 'Няма продукти'
                ];
            }

            // ---------------------------------------------------------
            // СТЪПКА 4: Връщаме резултата
            // ---------------------------------------------------------
            return $result->setData([
                'success'  => true,
                'debug_email' => $customerEmail, // Да видим дали е намерил имейла
                'orders'   => $formattedOrders,
                'requests' => $formattedRequests
            ]);

        } catch (\Exception $e) {
            return $result->setData(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}