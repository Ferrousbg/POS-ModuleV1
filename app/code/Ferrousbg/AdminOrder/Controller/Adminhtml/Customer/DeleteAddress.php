<?php
namespace Ferrousbg\AdminOrder\Controller\Adminhtml\Customer;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Customer\Api\AddressRepositoryInterface;

class DeleteAddress extends Action
{
    /**
     * @var JsonFactory
     */
    protected $resultJsonFactory;

    /**
     * @var AddressRepositoryInterface
     */
    protected $addressRepository;

    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        AddressRepositoryInterface $addressRepository
    ) {
        parent::__construct($context);
        $this->resultJsonFactory = $resultJsonFactory;
        $this->addressRepository = $addressRepository;
    }

    public function execute()
    {
        $result = $this->resultJsonFactory->create();

        // Взимаме ID-то от AJAX заявката
        $addressId = $this->getRequest()->getParam('address_id');

        if (!$addressId) {
            return $result->setData([
                'success' => false,
                'message' => __('Missing Address ID.')
            ]);
        }

        try {
            // Изтриване чрез Repository (най-сигурният начин в Magento)
            $this->addressRepository->deleteById($addressId);

            return $result->setData([
                'success' => true,
                'message' => __('Address deleted successfully.')
            ]);

        } catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
            return $result->setData([
                'success' => false,
                'message' => __('Address not found.')
            ]);
        } catch (\Exception $e) {
            return $result->setData([
                'success' => false,
                'message' => __('Error deleting address: ') . $e->getMessage()
            ]);
        }
    }
}