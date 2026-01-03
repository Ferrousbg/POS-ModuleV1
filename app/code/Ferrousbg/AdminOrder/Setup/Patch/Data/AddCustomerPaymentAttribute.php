<?php
namespace Ferrousbg\AdminOrder\Setup\Patch\Data;

use Magento\Customer\Model\Customer;
use Magento\Customer\Setup\CustomerSetupFactory;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class AddCustomerPaymentAttribute implements DataPatchInterface
{
    private $moduleDataSetup;
    private $customerSetupFactory;

    public function __construct(
        ModuleDataSetupInterface $moduleDataSetup,
        CustomerSetupFactory $customerSetupFactory
    ) {
        $this->moduleDataSetup = $moduleDataSetup;
        $this->customerSetupFactory = $customerSetupFactory;
    }

    public function apply()
    {
        $customerSetup = $this->customerSetupFactory->create(['setup' => $this->moduleDataSetup]);

        $customerSetup->addAttribute(Customer::ENTITY, 'pos_default_payment', [
            'type' => 'varchar',
            'label' => 'POS Default Payment Method',
            'input' => 'text',
            'required' => false,
            'visible' => true,
            'user_defined' => true,
            'system' => false,
            'position' => 100,
        ]);

        // Добавяме го към формите, за да може да се ползва
        $attribute = $customerSetup->getEavConfig()->getAttribute(Customer::ENTITY, 'pos_default_payment');
        $attribute->setData('used_in_forms', ['adminhtml_customer']);
        $attribute->save();
    }

    public static function getDependencies() { return []; }
    public function getAliases() { return []; }
}