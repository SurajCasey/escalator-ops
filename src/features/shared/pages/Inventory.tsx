
export default function Inventory () {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <header 
        className="p-6 flex justify-around items-center border-b border-gray-300 mb-4"
      >
        <div >
            <h1
            className="text-2xl font-bold mb-2">
                Equipment & Inventory
            </h1>
            <p
            className="text-gray-600 mb-4">
                Manage operational assets, maintenance schedules, and inventory levels.
            </p>
        </div>
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          <span></span> Add New Equipment
        </button>
      </header>

    </div>
  )
}
